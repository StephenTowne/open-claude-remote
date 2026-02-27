import { useAppStore } from '../../stores/app-store.js';

const STATUS_CONFIG = {
  idle: { color: 'var(--status-idle)', label: 'Idle' },
  running: { color: 'var(--status-running)', label: 'Running' },
  waiting_approval: { color: 'var(--status-waiting)', label: 'Waiting' },
} as const;

const CONNECTION_CONFIG = {
  connecting: { color: 'var(--status-waiting)', label: 'Connecting...' },
  connected: { color: 'var(--status-idle)', label: 'Connected' },
  disconnected: { color: 'var(--status-error)', label: 'Disconnected' },
} as const;

export function StatusBar() {
  const sessionStatus = useAppStore((s) => s.sessionStatus);
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const statusCfg = STATUS_CONFIG[sessionStatus];
  const connCfg = CONNECTION_CONFIG[connectionStatus];

  return (
    <div style={{
      height: 'var(--statusbar-height)',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      paddingTop: 'var(--safe-top)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          Claude Remote
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: statusCfg.color,
            display: 'inline-block',
          }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{statusCfg.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: connCfg.color,
            display: 'inline-block',
          }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{connCfg.label}</span>
        </div>
      </div>
    </div>
  );
}
