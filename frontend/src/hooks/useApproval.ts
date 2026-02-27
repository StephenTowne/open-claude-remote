import { useCallback } from 'react';
import { useAppStore } from '../stores/app-store.js';
import type { ClientMessage } from '@claude-remote/shared';

export function useApproval(send: (msg: ClientMessage) => void) {
  const pendingApproval = useAppStore((s) => s.pendingApproval);
  const setPendingApproval = useAppStore((s) => s.setPendingApproval);

  const approve = useCallback(() => {
    if (!pendingApproval) return;
    send({ type: 'approval_response', id: pendingApproval.id, approved: true });
    setPendingApproval(null);
  }, [pendingApproval, send, setPendingApproval]);

  const reject = useCallback(() => {
    if (!pendingApproval) return;
    send({ type: 'approval_response', id: pendingApproval.id, approved: false });
    setPendingApproval(null);
  }, [pendingApproval, send, setPendingApproval]);

  return { pendingApproval, approve, reject };
}
