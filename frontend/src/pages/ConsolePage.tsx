import { useRef, useCallback, useEffect } from 'react';
import type { ServerMessage } from '@claude-remote/shared';
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
function ConsoleContent({ wsUrl, instanceId }: { wsUrl?: string; instanceId?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { write, scrollToBottom, resize } = useTerminal(containerRef);
  const setSessionStatus = useAppStore((s) => s.setSessionStatus);

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'terminal_output':
        write(msg.data);
        scrollToBottom();
        break;
      case 'history_sync':
        write(msg.data);
        setSessionStatus(msg.status);
        // Sync PTY size to ensure ANSI sequences work correctly
        if (msg.cols && msg.rows) {
          resize(msg.cols, msg.rows);
        }
        scrollToBottom();
        break;
      case 'terminal_resize':
        // PTY size changed, sync xterm.js size
        resize(msg.cols, msg.rows);
        break;
      case 'status_update':
        setSessionStatus(msg.status);
        break;
      case 'session_ended':
        setSessionStatus('idle');
        break;
      case 'error':
        write(`\r\n\x1b[31m[Error] ${msg.message}\x1b[0m\r\n`);
        break;
    }
  }, [write, scrollToBottom, resize, setSessionStatus]);

  const { connect, send } = useWebSocket(handleMessage, wsUrl, instanceId);

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
      <VirtualKeyBar onKeyPress={handleKeyPress} />
      <InputBar onSend={handleSend} />
    </>
  );
}

export function ConsolePage() {
  const { keyboardHeight } = useViewport();
  usePushNotification();
  useInstances();

  const instances = useInstanceStore((s) => s.instances);
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);
  const setActiveInstanceId = useInstanceStore((s) => s.setActiveInstanceId);
  const cachedToken = useAppStore((s) => s.cachedToken);

  // 计算当前活跃实例的 WS URL
  const activeInstance = instances.find(i => i.instanceId === activeInstanceId);
  const isCurrent = activeInstance?.isCurrent ?? true;
  const wsUrl = activeInstance && !isCurrent
    ? buildInstanceWsUrl(activeInstance.host, activeInstance.port)
    : undefined; // undefined = 使用默认（当前实例）

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
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: keyboardHeight > 0 ? keyboardHeight : undefined,
      transition: 'padding-bottom 0.15s ease-out',
    }}>
      <StatusBar />
      <InstanceTabs onSwitch={handleInstanceSwitch} />
      {/* key=activeInstanceId 强制 React 重建整个终端+WS */}
      <ConsoleContent key={activeInstanceId ?? 'default'} wsUrl={wsUrl} instanceId={activeInstanceId ?? undefined} />
    </div>
  );
}
