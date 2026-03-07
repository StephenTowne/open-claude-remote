import { useAppStore } from '../../stores/app-store.js';
import { useInstanceStore } from '../../stores/instance-store.js';

export function ConnectionBanner() {
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);
  const instances = useInstanceStore((s) => s.instances);
  const serverAvailable = useAppStore((s) => s.serverAvailable);
  const connectionStatus = useAppStore((s) => {
    if (!activeInstanceId) {
      return s.connectionStatus;
    }
    return s.instanceConnectionStatus[activeInstanceId] ?? 'disconnected';
  });

  // Case 1: Server is up but has no instances → show "No instances"
  if (serverAvailable === true && instances.length === 0) {
    return (
      <div style={{
        position: 'fixed',
        top: 'calc(var(--statusbar-height) + var(--safe-top))',
        left: 0,
        right: 0,
        zIndex: 50,
        background: 'var(--status-waiting)',
        color: '#fff',
        textAlign: 'center',
        padding: '6px 16px',
        fontSize: 13,
        fontWeight: 500,
      }}>
        No instances available
      </div>
    );
  }

  // Case 2: Server is unreachable
  if (serverAvailable === false) {
    return (
      <div style={{
        position: 'fixed',
        top: 'calc(var(--statusbar-height) + var(--safe-top))',
        left: 0,
        right: 0,
        zIndex: 50,
        background: 'var(--status-error)',
        color: '#fff',
        textAlign: 'center',
        padding: '6px 16px',
        fontSize: 13,
        fontWeight: 500,
      }}>
        Server unavailable
      </div>
    );
  }

  // Case 3: Normal connection state (connecting/connected/disconnected)
  if (connectionStatus === 'connected') return null;

  return (
    <div style={{
      position: 'fixed',
      top: 'calc(var(--statusbar-height) + var(--safe-top))',
      left: 0,
      right: 0,
      zIndex: 50,
      background: connectionStatus === 'connecting' ? 'var(--status-waiting)' : 'var(--status-error)',
      color: '#fff',
      textAlign: 'center',
      padding: '6px 16px',
      fontSize: 13,
      fontWeight: 500,
    }}>
      {connectionStatus === 'connecting' ? 'Connecting…' : 'Disconnected. Reconnecting…'}
    </div>
  );
}
