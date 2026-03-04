import { useAppStore } from '../../stores/app-store.js';

export function IpChangeToast() {
  const ipChangeInfo = useAppStore((s) => s.ipChangeInfo);
  const setIpChangeInfo = useAppStore((s) => s.setIpChangeInfo);

  if (!ipChangeInfo) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(ipChangeInfo.newUrl);
    setIpChangeInfo(null);
  };

  const handleClose = () => {
    setIpChangeInfo(null);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 'calc(var(--statusbar-height) + var(--safe-top) + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        maxWidth: 'calc(100% - 32px)',
        background: 'var(--status-waiting)',
        color: '#fff',
        borderRadius: '8px',
        padding: '12px 16px',
        fontSize: '14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ fontWeight: 500 }}>
        IP Address Changed
      </div>
      <div style={{ fontSize: '13px', opacity: 0.9 }}>
        {ipChangeInfo.oldIp} → {ipChangeInfo.newIp}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <button
          onClick={handleCopyUrl}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Copy New URL
        </button>
        <button
          onClick={handleClose}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}