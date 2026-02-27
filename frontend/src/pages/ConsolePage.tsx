import { useRef, useCallback, useEffect } from 'react';
import type { ServerMessage } from '@claude-remote/shared';
import { StatusBar } from '../components/status/StatusBar.js';
import { TerminalView } from '../components/terminal/TerminalView.js';
import { InputBar } from '../components/input/InputBar.js';
import { ApprovalCard } from '../components/approval/ApprovalCard.js';
import { ConnectionBanner } from '../components/common/ConnectionBanner.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useTerminal } from '../hooks/useTerminal.js';
import { useApproval } from '../hooks/useApproval.js';
import { useViewport } from '../hooks/useViewport.js';
import { useAppStore } from '../stores/app-store.js';

export function ConsolePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { write, scrollToBottom } = useTerminal(containerRef);
  const setSessionStatus = useAppStore((s) => s.setSessionStatus);
  const setPendingApproval = useAppStore((s) => s.setPendingApproval);
  const { keyboardHeight } = useViewport();

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'terminal_output':
        write(msg.data);
        scrollToBottom();
        break;
      case 'history_sync':
        write(msg.data);
        setSessionStatus(msg.status);
        if (msg.pendingApproval) {
          setPendingApproval(msg.pendingApproval);
        }
        scrollToBottom();
        break;
      case 'status_update':
        setSessionStatus(msg.status);
        break;
      case 'approval_request':
        setPendingApproval(msg.approval);
        break;
      case 'session_ended':
        setSessionStatus('idle');
        break;
      case 'error':
        write(`\r\n\x1b[31m[Error] ${msg.message}\x1b[0m\r\n`);
        break;
    }
  }, [write, scrollToBottom, setSessionStatus, setPendingApproval]);

  const { connect, send } = useWebSocket(handleMessage);
  const { pendingApproval, approve, reject } = useApproval(send);

  // Connect only once on mount
  const connectCalledRef = useRef(false);
  useEffect(() => {
    if (!connectCalledRef.current) {
      connectCalledRef.current = true;
      connect();
    }
  }, [connect]);

  const handleSend = useCallback((text: string) => {
    // Send text first, then Enter key separately
    // The terminal (Claude Code CLI) requires these to be separate inputs
    send({ type: 'user_input', data: text });
    // Use setTimeout to ensure Enter is processed as a separate keystroke
    setTimeout(() => {
      send({ type: 'user_input', data: '\r' });
    }, 0);
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
      <InputBar onSend={handleSend} />
      {pendingApproval && (
        <ApprovalCard
          approval={pendingApproval}
          onApprove={approve}
          onReject={reject}
        />
      )}
    </div>
  );
}
