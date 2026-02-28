import { useAppStore } from '../../stores/app-store.js';
import { useInstanceStore } from '../../stores/instance-store.js';

export function ConnectionBanner() {
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);
  const status = useAppStore((s) => {
    if (!activeInstanceId) {
      return s.connectionStatus;
    }
    return s.instanceConnectionStatus[activeInstanceId] ?? 'disconnected';
  });

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
