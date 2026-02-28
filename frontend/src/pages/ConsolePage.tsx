import { useRef, useCallback, useEffect } from 'react';
import type { ServerMessage } from '@claude-remote/shared';
import { StatusBar } from '../components/status/StatusBar.js';
import { TerminalView } from '../components/terminal/TerminalView.js';
import { InputBar } from '../components/input/InputBar.js';
import { VirtualKeyBar } from '../components/input/VirtualKeyBar.js';
import { ConnectionBanner } from '../components/common/ConnectionBanner.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useTerminal } from '../hooks/useTerminal.js';
import { useViewport } from '../hooks/useViewport.js';
import { usePushNotification } from '../hooks/usePushNotification.js';
import { useAppStore } from '../stores/app-store.js';

export function ConsolePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { write, scrollToBottom } = useTerminal(containerRef);
  const setSessionStatus = useAppStore((s) => s.setSessionStatus);
  const { keyboardHeight } = useViewport();
  usePushNotification();

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'terminal_output':
        write(msg.data);
        scrollToBottom();
        break;
      case 'history_sync':
        write(msg.data);
        setSessionStatus(msg.status);
        scrollToBottom();
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
  }, [write, scrollToBottom, setSessionStatus]);

  const { connect, send } = useWebSocket(handleMessage);

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
      // Send text first, then Enter key separately
      send({ type: 'user_input', data: text });
      setTimeout(() => {
        send({ type: 'user_input', data: '\r' });
      }, 0);
    } else {
      // Empty submit = just Enter
      send({ type: 'user_input', data: '\r' });
    }
  }, [send]);

  const handleKeyPress = useCallback((data: string) => {
    send({ type: 'user_input', data });
  }, [send]);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: keyboardHeight > 0 ? keyboardHeight : undefined,
      transition: 'padding-bottom 0.15s ease-out',
    }}>
      <StatusBar />
      <ConnectionBanner />
      <TerminalView containerRef={containerRef} />
      <VirtualKeyBar onKeyPress={handleKeyPress} />
      <InputBar onSend={handleSend} />
    </div>
  );
}
