import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import type { ServerMessage, InstanceListItem, Question, PermissionSuggestion } from '@claude-remote/shared';
import { isFreeTextLabel } from '@claude-remote/shared';
import { StatusBar } from '../components/status/StatusBar.js';
import { TerminalView } from '../components/terminal/TerminalView.js';
import { InputBar } from '../components/input/InputBar.js';
import { VirtualKeyBar } from '../components/input/VirtualKeyBar.js';
import { QuestionPanel } from '../components/input/QuestionPanel.js';
import { PermissionPanel } from '../components/input/PermissionPanel.js';
import { ConnectionBanner } from '../components/common/ConnectionBanner.js';
import { IpChangeToast } from '../components/common/IpChangeToast.js';
import { InstanceTabs } from '../components/instances/InstanceTabs.js';
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

interface AskState {
  questions: Question[];
  currentIndex: number;
  selectedIndex: number;
  selectedOptions: Set<number>;
  isOtherInput: boolean;
  otherText: string;
}

interface PermissionState {
  requestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  permissionSuggestions?: PermissionSuggestion[];
}

function ConsoleContent({ wsUrl, instanceId, showVirtualKeyBar, onIpChanged }: { wsUrl?: string; instanceId?: string; showVirtualKeyBar: boolean; onIpChanged?: (newIp: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setSessionStatus = useAppStore((s) => s.setSessionStatus);
  const setIpChangeInfo = useAppStore((s) => s.setIpChangeInfo);
  const { showNotification } = useLocalNotification();

  // 用 ref 打破循环依赖：handleMessage ↔ write，send ↔ onResize
  const sendRef = useRef<ReturnType<typeof useWebSocket>['send'] | null>(null);
  // 初始值为 no-op，在 useTerminal 返回真实函数后立即更新
  const writeRef = useRef((_data: string, _cb?: () => void) => {});
  const scrollToBottomRef = useRef(() => {});
  const adaptToPtyColsRef = useRef((_cols: number, _rows?: number) => {});

  // 当前 ask_question 交互状态
  const [askState, setAskState] = useState<AskState | null>(null);
  const askStateRef = useRef<AskState | null>(null);
  askStateRef.current = askState;

  // 当前权限请求状态
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'terminal_output':
        writeRef.current(msg.data);
        break;
      case 'history_sync':
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
        // 非 waiting_input 时清理问答面板
        if (msg.status !== 'waiting_input') {
          setAskState(null);
          setPermissionState(null);
        } else {
          // 收到 waiting_input 时发送本地通知
          showNotification({
            title: 'Claude Code 需要输入',
            body: msg.detail ?? 'Claude 正在等待你的输入',
            tag: 'claude-waiting-input',
            renotify: false,
          });
        }
        break;
      case 'ask_question':
        setAskState({
          questions: msg.questions,
          currentIndex: 0,
          selectedIndex: 0,
          selectedOptions: new Set(),
          isOtherInput: false,
          otherText: '',
        });
        // 收到提问时发送本地通知
        showNotification({
          title: 'Claude Code 需要回答',
          body: msg.questions[0]?.question ?? 'Claude 提出了问题',
          tag: 'claude-ask-question',
          renotify: false,
        });
        break;
      case 'permission_request':
        // 权限请求到达时清除旧的问答状态，避免权限处理后残留 QuestionPanel
        setAskState(null);
        setPermissionState({
          requestId: msg.requestId,
          toolName: msg.toolName,
          toolInput: msg.toolInput,
          permissionSuggestions: msg.permissionSuggestions,
        });
        showNotification({
          title: 'Claude Code 权限请求',
          body: `请求使用 ${msg.toolName}`,
          tag: 'claude-permission',
          renotify: false,
        });
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

  const { write, scrollToBottom, adaptToPtyCols } = useTerminal(
    containerRef,
    useCallback((cols: number, rows: number) => {
      if (cols >= 80) {
        sendRef.current?.({ type: 'resize', cols, rows });
      }
    }, []),
  );

  writeRef.current = write;
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

  // 选项选择处理
  const handleQuestionSelect = useCallback((targetIndex: number) => {
    const state = askStateRef.current;
    if (!state) return;
    const q = state.questions[state.currentIndex];
    if (!q || targetIndex < 0 || targetIndex >= q.options.length) return;

    // 导航到目标选项
    const diff = targetIndex - state.selectedIndex;
    const arrowKey = diff > 0 ? '\x1b[B' : '\x1b[A';
    for (let i = 0; i < Math.abs(diff); i++) {
      send({ type: 'user_input', data: arrowKey });
    }

    const option = q.options[targetIndex];
    const isOther = isFreeTextLabel(option.label);

    // 发送 Enter 选择
    send({ type: 'user_input', data: '\r' });

    if (isOther) {
      setAskState(prev => prev ? { ...prev, selectedIndex: targetIndex, isOtherInput: true, otherText: '' } : null);
    } else if (q.multiSelect) {
      setAskState(prev => {
        if (!prev) return null;
        const next = new Set(prev.selectedOptions);
        if (next.has(targetIndex)) next.delete(targetIndex); else next.add(targetIndex);
        return { ...prev, selectedIndex: targetIndex, selectedOptions: next };
      });
    } else {
      // 单选：推进到下一个问题或结束
      const nextIndex = state.currentIndex + 1;
      if (nextIndex < state.questions.length) {
        setAskState(prev => prev ? {
          ...prev, currentIndex: nextIndex, selectedIndex: 0,
          selectedOptions: new Set(), isOtherInput: false, otherText: '',
        } : null);
      } else {
        setAskState(null);
      }
    }
  }, [send]);

  const handleOtherInputChange = useCallback((text: string) => {
    setAskState(prev => prev ? { ...prev, otherText: text } : null);
  }, []);

  const handleOtherSubmit = useCallback(() => {
    const state = askStateRef.current;
    if (!state) return;

    const text = state.otherText.trim();
    if (!text) return;
    send({ type: 'user_input', data: text });
    send({ type: 'user_input', data: '\r' });

    const nextIndex = state.currentIndex + 1;
    if (nextIndex < state.questions.length) {
      setAskState(prev => prev ? {
        ...prev, currentIndex: nextIndex, selectedIndex: 0,
        selectedOptions: new Set(), isOtherInput: false, otherText: '',
      } : null);
    } else {
      setAskState(null);
    }
  }, [send]);

  useEffect(() => {
    if (!askState) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      send({ type: 'user_input', data: '\x1b' });
      setAskState(null);
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [askState, send]);

  const handlePermissionAllow = useCallback((alwaysAllow: boolean = false) => {
    if (!permissionState) return;
    send({
      type: 'permission_decision',
      requestId: permissionState.requestId,
      behavior: 'allow',
      updatedPermissions: alwaysAllow ? permissionState.permissionSuggestions : undefined,
    });
    setPermissionState(null);
  }, [send, permissionState]);

  const handlePermissionDeny = useCallback(() => {
    if (!permissionState) return;
    send({
      type: 'permission_decision',
      requestId: permissionState.requestId,
      behavior: 'deny',
    });
    setPermissionState(null);
  }, [send, permissionState]);

  return (
    <>
      <ConnectionBanner />
      <IpChangeToast />
      <TerminalView containerRef={containerRef} />
      {permissionState ? (
        <PermissionPanel
          toolName={permissionState.toolName}
          toolInput={permissionState.toolInput}
          permissionSuggestions={permissionState.permissionSuggestions}
          onAllow={handlePermissionAllow}
          onDeny={handlePermissionDeny}
        />
      ) : askState ? (
        <QuestionPanel
          questions={askState.questions}
          currentQuestionIndex={askState.currentIndex}
          selectedIndex={askState.selectedIndex}
          selectedOptions={askState.selectedOptions}
          otherInput={askState.isOtherInput ? askState.otherText : undefined}
          onSelect={handleQuestionSelect}
          onOtherInputChange={handleOtherInputChange}
          onOtherSubmit={handleOtherSubmit}
        />
      ) : (
        <>
          <VirtualKeyBar onKeyPress={handleKeyPress} visible={showVirtualKeyBar} />
          <InputBar onSend={handleSend} />
        </>
      )}
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
        showVirtualKeyBar={showVirtualKeyBar}
        onIpChanged={activeInstance?.isCurrent ? handleCurrentInstanceIpChanged : undefined}
      />
      {toastMessage && <div className="app-toast" role="status" aria-live="polite">{toastMessage}</div>}
    </div>
  );
}
