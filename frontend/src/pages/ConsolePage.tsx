import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import type { ServerMessage, InstanceListItem } from '@claude-remote/shared';
import { StatusBar } from '../components/status/StatusBar.js';
import { TerminalView } from '../components/terminal/TerminalView.js';
import { InputBar, type InputBarRef } from '../components/input/InputBar.js';
import { CommandPicker } from '../components/input/CommandPicker.js';
import { ConnectionBanner } from '../components/common/ConnectionBanner.js';
import { IpChangeToast } from '../components/common/IpChangeToast.js';
import { InstanceTabs } from '../components/instances/InstanceTabs.js';
import { OnboardingGuide } from '../components/onboarding/OnboardingGuide.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useTerminal } from '../hooks/useTerminal.js';
import { useViewport } from '../hooks/useViewport.js';
import { usePushNotification } from '../hooks/usePushNotification.js';
import { useLocalNotification } from '../hooks/useLocalNotification.js';
import { useInstances } from '../hooks/useInstances.js';
import { useAppStore } from '../stores/app-store.js';
import { useInstanceStore } from '../stores/instance-store.js';
import { authenticate } from '../services/api-client.js';
import { authenticateToInstance, buildInstanceWsUrl } from '../services/instance-api.js';

function ConsoleContent({ wsUrl, instanceId, showCommandPicker, onIpChanged }: { wsUrl?: string; instanceId?: string; showCommandPicker: boolean; onIpChanged?: (newIp: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputBarRef = useRef<InputBarRef>(null);
  const setSessionStatus = useAppStore((s) => s.setSessionStatus);
  const setIpChangeInfo = useAppStore((s) => s.setIpChangeInfo);
  const { showNotification } = useLocalNotification();

  // 用 ref 打破循环依赖：handleMessage ↔ write，send ↔ onResize
  const sendRef = useRef<ReturnType<typeof useWebSocket>['send'] | null>(null);
  // 初始值为 no-op，在 useTerminal 返回真实函数后立即更新
  const writeRef = useRef((_data: string, _cb?: () => void) => {});
  const resetRef = useRef(() => {});
  const scrollToBottomRef = useRef(() => {});
  const adaptToPtyColsRef = useRef((_cols: number, _rows?: number) => {});

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'terminal_output':
        writeRef.current(msg.data);
        break;
      case 'history_sync':
        // 重置终端状态，避免重连时内容叠加
        resetRef.current();
        if (msg.cols && msg.cols > 0) {
          adaptToPtyColsRef.current(msg.cols, msg.rows);
        }
        writeRef.current(msg.data);
        setSessionStatus(msg.status);
        scrollToBottomRef.current();
        break;
      case 'terminal_resize':
        if (msg.cols && msg.cols > 0) {
          adaptToPtyColsRef.current(msg.cols, msg.rows);
        }
        break;
      case 'status_update':
        setSessionStatus(msg.status);
        // 收到 waiting_input 时发送本地通知（用于 permission prompt）
        if (msg.status === 'waiting_input') {
          showNotification({
            title: 'Claude Code 需要输入',
            body: msg.detail ?? 'Claude 正在等待你的输入',
            tag: 'claude-waiting-input',
            renotify: false,
          });
        }
        break;
      case 'session_ended':
        setSessionStatus('idle');
        break;
      case 'error':
        writeRef.current(`\r\n\x1b[31m[Error] ${msg.message}\x1b[0m\r\n`);
        break;
      case 'heartbeat':
        break;
      case 'ip_changed':
        setIpChangeInfo({
          oldIp: msg.oldIp,
          newIp: msg.newIp,
          newUrl: msg.newUrl,
        });
        onIpChanged?.(msg.newIp);
        break;
    }
  }, [setSessionStatus, setIpChangeInfo, onIpChanged, showNotification]);

  const { connect, send } = useWebSocket(handleMessage, wsUrl, instanceId);
  sendRef.current = send;

  const { write, reset, scrollToBottom, adaptToPtyCols } = useTerminal(
    containerRef,
    useCallback((cols: number, rows: number) => {
      return sendRef.current?.({ type: 'resize', cols, rows }) ?? false;
    }, []),
  );

  writeRef.current = write;
  resetRef.current = reset;
  scrollToBottomRef.current = scrollToBottom;
  adaptToPtyColsRef.current = adaptToPtyCols;

  // Connect only once on mount
  const connectCalledRef = useRef(false);
  useEffect(() => {
    if (!connectCalledRef.current) {
      connectCalledRef.current = true;
      connect();
    }
  }, [connect]);

  const handleSend = useCallback((text: string) => {
    if (text) {
      send({ type: 'user_input', data: text });
      setTimeout(() => {
        send({ type: 'user_input', data: '\r' });
      }, 0);
    } else {
      send({ type: 'user_input', data: '\r' });
    }
  }, [send]);

  const handleKeyPress = useCallback((data: string) => {
    send({ type: 'user_input', data });
  }, [send]);

  // 命令选择处理：填入输入框
  const handleCommandSelect = useCallback((command: string) => {
    inputBarRef.current?.setText(command);
  }, []);

  return (
    <>
      <ConnectionBanner />
      <IpChangeToast />
      <TerminalView containerRef={containerRef} />
      <CommandPicker
        onShortcut={handleKeyPress}
        onCommandSelect={handleCommandSelect}
        visible={showCommandPicker}
      />
      <InputBar ref={inputBarRef} onSend={handleSend} />
    </>
  );
}

function getAutoSwitchCandidates(instances: InstanceListItem[], currentInstanceId: string, currentPort?: number) {
  const sorted = instances
    .filter((instance) => instance.instanceId !== currentInstanceId)
    .sort((a, b) => a.port - b.port);

  if (sorted.length === 0) {
    return [];
  }

  if (currentPort === undefined) {
    return sorted;
  }

  const startIndex = sorted.findIndex((instance) => instance.port > currentPort);
  if (startIndex === -1) {
    return sorted;
  }

  return [...sorted.slice(startIndex), ...sorted.slice(0, startIndex)];
}

export function ConsolePage() {
  const { keyboardHeight } = useViewport();
  const showCommandPicker = keyboardHeight === 0;

  usePushNotification();
  useInstances();

  const instances = useInstanceStore((s) => s.instances);
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);
  const setActiveInstanceId = useInstanceStore((s) => s.setActiveInstanceId);
  const currentHostOverride = useInstanceStore((s) => s.currentHostOverride);
  const setCurrentHostOverride = useInstanceStore((s) => s.setCurrentHostOverride);

  const cachedToken = useAppStore((s) => s.cachedToken);
  const instanceConnectionStatus = useAppStore((s) => s.instanceConnectionStatus);
  const toastMessage = useAppStore((s) => s.toastMessage);
  const showToast = useAppStore((s) => s.showToast);
  const hideToast = useAppStore((s) => s.hideToast);

  const isAutoSwitchingRef = useRef(false);
  const lastSwitchSourceRef = useRef<string | null>(null);
  const lastKnownActivePortRef = useRef<number | undefined>(undefined);

  // 计算当前活跃实例的 WS URL
  const activeInstance = instances.find(i => i.instanceId === activeInstanceId);
  const isCurrent = activeInstance?.isCurrent ?? true;
  const effectiveHost = useMemo(() => {
    if (!activeInstance) return undefined;
    return activeInstance.isCurrent
      ? (currentHostOverride ?? activeInstance.host)
      : activeInstance.host;
  }, [activeInstance, currentHostOverride]);

  const wsUrl = activeInstance && effectiveHost
    ? buildInstanceWsUrl(effectiveHost, activeInstance.port)
    : undefined;

  useEffect(() => {
    if (activeInstance?.port !== undefined) {
      lastKnownActivePortRef.current = activeInstance.port;
    }
  }, [activeInstance]);

  useEffect(() => {
    if (!activeInstance?.isCurrent) {
      setCurrentHostOverride(null);
    }
  }, [activeInstance, setCurrentHostOverride]);

  useEffect(() => {
    if (!activeInstanceId) {
      return;
    }

    const activeMissing = !activeInstance;
    const activeDisconnected = instanceConnectionStatus[activeInstanceId] === 'disconnected';
    const shouldAutoSwitch = activeMissing || activeDisconnected;

    if (!shouldAutoSwitch || isAutoSwitchingRef.current) {
      return;
    }

    if (lastSwitchSourceRef.current === activeInstanceId) {
      return;
    }

    const currentPort = activeInstance?.port ?? lastKnownActivePortRef.current;
    const candidates = getAutoSwitchCandidates(instances, activeInstanceId, currentPort);
    if (candidates.length === 0) {
      return;
    }

    isAutoSwitchingRef.current = true;
    lastSwitchSourceRef.current = activeInstanceId;

    const run = async () => {
      for (const candidate of candidates) {
        if (cachedToken) {
          try {
            if (candidate.isCurrent) {
              await authenticate(cachedToken);
            } else {
              const authenticated = await authenticateToInstance(candidate.host, candidate.port, cachedToken);
              if (!authenticated) {
                continue;
              }
            }
          } catch {
            continue;
          }
        }

        setActiveInstanceId(candidate.instanceId);
        showToast(`已切换到 ${candidate.port}`);
        break;
      }

      isAutoSwitchingRef.current = false;
    };

    void run();
  }, [
    activeInstance,
    activeInstanceId,
    cachedToken,
    instanceConnectionStatus,
    instances,
    setActiveInstanceId,
    showToast,
  ]);

  // 自动消失：toast 显示 3s 后关闭
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => hideToast(), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage, hideToast]);

  const handleInstanceSwitch = useCallback(async (targetId: string) => {
    const target = instances.find(i => i.instanceId === targetId);
    if (!target) return;

    // 所有实例都需要认证：isCurrent 用同源 authenticate，非 isCurrent 用跨实例认证
    if (cachedToken) {
      try {
        if (target.isCurrent) {
          await authenticate(cachedToken);
        } else {
          await authenticateToInstance(target.host, target.port, cachedToken);
        }
      } catch {
        // 认证失败时仍然切换，WS 连接会失败并显示 Disconnected
      }
    }

    setCurrentHostOverride(null);
    setActiveInstanceId(targetId);
  }, [instances, cachedToken, setActiveInstanceId, setCurrentHostOverride]);

  const handleCurrentInstanceIpChanged = useCallback((newIp: string) => {
    setCurrentHostOverride(newIp);
  }, [setCurrentHostOverride]);

  return (
    <div data-testid="console-page" style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: keyboardHeight > 0 ? keyboardHeight : undefined,
      transition: 'padding-bottom 0.15s ease-out',
    }}>
      <StatusBar />
      <InstanceTabs onSwitch={handleInstanceSwitch} />
      {/* key=activeInstanceId 强制 React 重建整个终端+WS */}
      <ConsoleContent
        key={`${activeInstanceId ?? 'default'}:${effectiveHost ?? 'none'}`}
        wsUrl={wsUrl}
        instanceId={activeInstanceId ?? undefined}
        showCommandPicker={showCommandPicker}
        onIpChanged={activeInstance?.isCurrent ? handleCurrentInstanceIpChanged : undefined}
      />
      {toastMessage && <div className="app-toast" role="status" aria-live="polite">{toastMessage}</div>}
      <OnboardingGuide />
    </div>
  );
}
