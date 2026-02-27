import { useAppStore } from '../../stores/app-store.js';

export function ConnectionBanner() {
  const status = useAppStore((s) => s.connectionStatus);

  if (status === 'connected') return null;

  return (
    <div style={{
      position: 'fixed',
      top: 'calc(var(--statusbar-height) + var(--safe-top))',
      left: 0,
      right: 0,
      zIndex: 50,
      background: status === 'connecting' ? 'var(--status-waiting)' : 'var(--status-error)',
      color: '#fff',
      textAlign: 'center',
      padding: '6px 16px',
      fontSize: 13,
      fontWeight: 500,
    }}>
      {status === 'connecting' ? 'Connecting...' : 'Disconnected. Reconnecting...'}
    </div>
  );
}
