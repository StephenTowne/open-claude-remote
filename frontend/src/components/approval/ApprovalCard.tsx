import type { ApprovalRequest } from '@claude-remote/shared';

interface ApprovalCardProps {
  approval: ApprovalRequest;
  onApprove: () => void;
  onReject: () => void;
}

export function ApprovalCard({ approval, onApprove, onReject }: ApprovalCardProps) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
    }}>
      {/* Backdrop — tap to reject */}
      <div
        onClick={onReject}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--bg-overlay)',
        }}
      />

      {/* Card */}
      <div style={{
        position: 'relative',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        borderRadius: '16px 16px 0 0',
        padding: '20px 16px',
        paddingBottom: 'calc(20px + var(--safe-bottom))',
        maxHeight: '50vh',
        overflow: 'auto',
      }}>
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--text-muted)',
          margin: '0 auto 16px',
        }} />

        {/* Title */}
        <div style={{
          fontSize: 16, fontWeight: 600,
          color: 'var(--status-waiting)',
          marginBottom: 12,
        }}>
          Approval Required
        </div>

        {/* Tool info */}
        <div style={{
          background: 'var(--bg-tertiary)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Tool
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
            {approval.tool}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Description
          </div>
          <div style={{
            fontSize: 14, color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {approval.description}
          </div>
          {approval.params && (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, marginBottom: 4 }}>
                Parameters
              </div>
              <pre style={{
                fontSize: 12, fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                margin: 0,
              }}>
                {JSON.stringify(approval.params, null, 2)}
              </pre>
            </>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onReject}
            style={{
              flex: 1, height: 'var(--min-touch-target)',
              borderRadius: 8,
              background: 'var(--reject-bg)',
              color: '#fff',
              fontWeight: 600, fontSize: 16,
            }}
          >
            Reject
          </button>
          <button
            onClick={onApprove}
            style={{
              flex: 1, height: 'var(--min-touch-target)',
              borderRadius: 8,
              background: 'var(--approve-bg)',
              color: '#fff',
              fontWeight: 600, fontSize: 16,
            }}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
