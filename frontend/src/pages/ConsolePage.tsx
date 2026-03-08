import { useRef, useCallback, useEffect } from 'react';
import type { ServerMessage, InstanceListItem } from '#shared';
import { StatusBar } from '../components/status/StatusBar.js';
import { TerminalView } from '../components/terminal/TerminalView.js';
import { InputBar, type InputBarRef } from '../components/input/InputBar.js';
import { CommandPicker } from '../components/input/CommandPicker.js';
import { ConnectionBanner } from '../components/common/ConnectionBanner.js';
import { IpChangeToast } from '../components/common/IpChangeToast.js';
import { InstanceTabs } from '../components/instances/InstanceTabs.js';
import { ScrollToBottomButton } from '../components/terminal/ScrollToBottomButton.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useTerminal } from '../hooks/useTerminal.js';
import { useViewport } from '../hooks/useViewport.js';
import { usePushNotification } from '../hooks/usePushNotification.js';
import { useLocalNotification } from '../hooks/useLocalNotification.js';
import { useInstances } from '../hooks/useInstances.js';
import { useAppStore } from '../stores/app-store.js';
import { useInstanceStore } from '../stores/instance-store.js';
import { authenticate } from '../services/api-client.js';
import { buildInstanceWsUrl } from '../services/instance-api.js';

function ConsoleContent({ wsUrl, instanceId, showCommandPicker, isKeyboardOpen }: { wsUrl?: string; instanceId?: string; showCommandPicker: boolean; isKeyboardOpen: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputBarRef = useRef<InputBarRef>(null);
  const setSessionStatus = useAppStore((s) => s.setSessionStatus);
  const setIpChangeInfo = useAppStore((s) => s.setIpChangeInfo);
  const setInstanceConnectionStatus = useAppStore((s) => s.setInstanceConnectionStatus);
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
        // 始终适应自己的可视区域并上报尺寸，确保重连后恢复正确尺寸
        // 不依赖 history_sync 中的 PTY 尺寸（可能是 PC 端的旧尺寸）
        adaptToPtyColsRef.current(0, 0);
        writeRef.current(msg.data);
        setSessionStatus(msg.status);
        // 注意：不强制滚动到底部，尊重用户的当前滚动位置
        // 如果用户正在浏览历史内容，保持其视图位置
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
        // 立即标记连接断开，触发自动切换（不等 WebSocket onclose）
        if (instanceId) {
          setInstanceConnectionStatus(instanceId, 'disconnected');
        }
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
        break;
    }
  }, [setSessionStatus, setIpChangeInfo, showNotification]);

  const { connect, send } = useWebSocket(handleMessage, wsUrl, instanceId);
  sendRef.current = send;

  const { write, reset, scrollToBottom, setAutoFollow, showScrollHint, adaptToPtyCols } = useTerminal(
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

  // 命令发送处理：直接发送给 PTY
  const handleCommandSend = useCallback((command: string) => {
    send({ type: 'user_input', data: command });
    send({ type: 'user_input', data: '\r' });
  }, [send]);

  // 处理"回到最新"按钮点击
  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
    setAutoFollow(true);
  }, [scrollToBottom, setAutoFollow]);

  return (
    <>
      <ConnectionBanner />
      <IpChangeToast />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TerminalView containerRef={containerRef} />
        <ScrollToBottomButton visible={showScrollHint} onClick={handleScrollToBottom} />
      </div>
      <CommandPicker
        onShortcut={handleKeyPress}
        onCommandSelect={handleCommandSelect}
        onCommandSend={handleCommandSend}
        visible={showCommandPicker}
      />
      <InputBar ref={inputBarRef} onSend={handleSend} isKeyboardOpen={isKeyboardOpen} />
    </>
  );
}

function getAutoSwitchCandidates(instances: InstanceListItem[], currentInstanceId: string) {
  // Sort by startedAt ascending (oldest first) — prefer more established instances
  return instances
    .filter((instance) => instance.instanceId !== currentInstanceId)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export function ConsolePage() {
  const { offsetTop, needsCompensation } = useViewport();
  // 键盘检测：needsCompensation=true 表示输入框被软键盘遮挡
  // 检测键盘是否真正打开：visualViewport.offsetTop > 0 表示有键盘或工具栏
  const isKeyboardOpen = needsCompensation && offsetTop > 0;
  const showCommandPicker = !isKeyboardOpen;

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

  // 计算当前活跃实例的 WS URL（同源，按 instanceId 路由）
  const activeInstance = instances.find(i => i.instanceId === activeInstanceId);
  const wsUrl = activeInstanceId ? buildInstanceWsUrl(activeInstanceId) : undefined;

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

    const candidates = getAutoSwitchCandidates(instances, activeInstanceId);
    if (candidates.length === 0) {
      return;
    }

    isAutoSwitchingRef.current = true;
    lastSwitchSourceRef.current = activeInstanceId;

    const run = async () => {
      // 同源认证：所有实例共享同一个 session
      if (cachedToken) {
        try {
          await authenticate(cachedToken);
        } catch {
          // 认证失败仍然尝试切换
        }
      }

      const candidate = candidates[0];
      setActiveInstanceId(candidate.instanceId);
      showToast(`Switched to ${candidate.name}`);
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
    // 同源认证：确保 session 有效
    if (cachedToken) {
      try {
        await authenticate(cachedToken);
      } catch {
        // 认证失败时仍然切换
      }
    }
    setActiveInstanceId(targetId);
    // 显示切换提示（仅手动切换时，与自动切换的提示保持一致）
    const targetInstance = instances.find(i => i.instanceId === targetId);
    if (targetInstance) {
      showToast(`Switched to ${targetInstance.name}`);
    }
  }, [cachedToken, setActiveInstanceId, instances, showToast]);

  // 复制成功后自动切换到新实例
  // InstanceTabs.handleCreateSuccess 已轮询并更新了 store，这里直接读取切换
  const handleCopySuccess = useCallback(async (newInstanceName: string) => {
    const currentInstances = useInstanceStore.getState().instances;
    // 按 startedAt 倒序找最新的同名实例，避免重名歧义
    const found = [...currentInstances]
      .filter(inst => inst.name === newInstanceName)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];

    if (!found) {
      showToast('Instance created, but switch failed');
      return;
    }

    setActiveInstanceId(found.instanceId);
    showToast(`Created and switched to ${newInstanceName}`);
  }, [setActiveInstanceId, showToast]);

  return (
    <div data-testid="console-page" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      // 保持固定高度，用 transform 实现平滑滚动
      height: '100dvh',
      // 使用 transform 替代 top 修改，避免布局重计算，实现平滑过渡
      transform: needsCompensation ? `translateY(-${offsetTop}px)` : 'none',
      transition: 'transform 0.25s ease-out',
      // 性能优化：仅在需要补偿时启用 GPU 加速
      willChange: needsCompensation ? 'transform' : 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <StatusBar />
      <InstanceTabs onSwitch={handleInstanceSwitch} onCopySuccess={handleCopySuccess} />
      {/* key=activeInstanceId 强制 React 重建整个终端+WS */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ConsoleContent
          key={activeInstanceId ?? 'default'}
          wsUrl={wsUrl}
          instanceId={activeInstanceId ?? undefined}
          showCommandPicker={showCommandPicker}
          isKeyboardOpen={isKeyboardOpen}
        />
      </div>
      {toastMessage && <div className="app-toast app-toast-top" role="status" aria-live="polite">{toastMessage}</div>}
    </div>
  );
}