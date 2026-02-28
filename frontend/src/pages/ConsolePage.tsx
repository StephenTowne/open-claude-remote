import { useRef, useCallback, useEffect } from 'react';
import type { ServerMessage, InstanceListItem } from '@claude-remote/shared';
import { StatusBar } from '../components/status/StatusBar.js';
import { TerminalView } from '../components/terminal/TerminalView.js';
import { InputBar } from '../components/input/InputBar.js';
import { VirtualKeyBar } from '../components/input/VirtualKeyBar.js';
import { ConnectionBanner } from '../components/common/ConnectionBanner.js';
import { InstanceTabs } from '../components/instances/InstanceTabs.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useTerminal } from '../hooks/useTerminal.js';
import { useViewport } from '../hooks/useViewport.js';
import { usePushNotification } from '../hooks/usePushNotification.js';
import { useInstances } from '../hooks/useInstances.js';
import { useAppStore } from '../stores/app-store.js';
import { useInstanceStore } from '../stores/instance-store.js';
import { authenticateToInstance, buildInstanceWsUrl } from '../services/instance-api.js';

/**
 * 终端内容子组件。用 key={instanceId} 强制重建以实现 Tab 切换时
 * 旧 WS 关闭 + 新 WS 建连 + history_sync 恢复。
 */
function ConsoleContent({ wsUrl, instanceId, showVirtualKeyBar }: { wsUrl?: string; instanceId?: string; showVirtualKeyBar: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setSessionStatus = useAppStore((s) => s.setSessionStatus);

  // 用 ref 打破循环依赖：handleMessage ↔ write，send ↔ onResize
  const sendRef = useRef<ReturnType<typeof useWebSocket>['send'] | null>(null);
  // 初始值为 no-op，在 useTerminal 返回真实函数后立即更新
  const writeRef = useRef((_data: string) => {});
  const scrollToBottomRef = useRef(() => {});

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'terminal_output':
        writeRef.current(msg.data);
        scrollToBottomRef.current();
        break;
      case 'history_sync':
        writeRef.current(msg.data);
        setSessionStatus(msg.status);
        // fitAddon 控制尺寸，并自动通知后端，无需强制 resize xterm
        scrollToBottomRef.current();
        break;
      case 'terminal_resize':
        // PTY 尺寸变化通知（忽略，xterm 以 fitAddon 为准）
        break;
      case 'status_update':
        setSessionStatus(msg.status);
        break;
      case 'session_ended':
        setSessionStatus('idle');
        break;
      case 'error':
        writeRef.current(`\r\n\x1b[31m[Error] ${msg.message}\x1b[0m\r\n`);
        break;
    }
  }, [setSessionStatus]);

  const { connect, send } = useWebSocket(handleMessage, wsUrl, instanceId);
  sendRef.current = send;

  const { write, scrollToBottom } = useTerminal(
    containerRef,
    useCallback((cols: number, rows: number) => {
      // 移动端窄视口（< 80 cols）不发送 resize，避免覆盖 PC 端 PTY 尺寸
      if (cols >= 80) {
        sendRef.current?.({ type: 'resize', cols, rows });
      }
    }, []),
  );

  // 每次渲染后同步 ref，确保 handleMessage 中调用的是最新版本
  writeRef.current = write;
  scrollToBottomRef.current = scrollToBottom;

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

  return (
    <>
      <ConnectionBanner />
      <TerminalView containerRef={containerRef} />
      <VirtualKeyBar onKeyPress={handleKeyPress} visible={showVirtualKeyBar} />
      <InputBar onSend={handleSend} />
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
  const showVirtualKeyBar = keyboardHeight === 0;

  usePushNotification();
  useInstances();

  const instances = useInstanceStore((s) => s.instances);
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);
  const setActiveInstanceId = useInstanceStore((s) => s.setActiveInstanceId);

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
  const wsUrl = activeInstance && !isCurrent
    ? buildInstanceWsUrl(activeInstance.host, activeInstance.port)
    : undefined; // undefined = 使用默认（当前实例）

  useEffect(() => {
    if (activeInstance?.port !== undefined) {
      lastKnownActivePortRef.current = activeInstance.port;
    }
  }, [activeInstance]);

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
        if (!candidate.isCurrent && cachedToken) {
          try {
            const authenticated = await authenticateToInstance(candidate.host, candidate.port, cachedToken);
            if (!authenticated) {
              continue;
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

    // 如果目标不是当前实例，需要先认证
    if (!target.isCurrent && cachedToken) {
      try {
        await authenticateToInstance(target.host, target.port, cachedToken);
      } catch {
        // 认证失败时仍然切换，WS 连接会失败并显示 Disconnected
      }
    }

    setActiveInstanceId(targetId);
  }, [instances, cachedToken, setActiveInstanceId]);

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
        key={activeInstanceId ?? 'default'}
        wsUrl={wsUrl}
        instanceId={activeInstanceId ?? undefined}
        showVirtualKeyBar={showVirtualKeyBar}
      />
      {toastMessage && <div className="app-toast" role="status" aria-live="polite">{toastMessage}</div>}
    </div>
  );
}
