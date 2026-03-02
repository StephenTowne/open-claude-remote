import { useState } from 'react';
import { useAppStore } from '../../stores/app-store.js';
import { useInstanceStore } from '../../stores/instance-store.js';
import { notifyConfigChanged } from '../../hooks/useUserConfig.js';
import { SettingsModal } from '../settings/SettingsModal.js';

const STATUS_CONFIG = {
  idle: { color: 'var(--status-idle)', label: 'Idle' },
  running: { color: 'var(--status-running)', label: 'Running' },
  waiting_input: { color: 'var(--status-waiting)', label: 'Waiting Input' },
} as const;

const CONNECTION_CONFIG = {
  connecting: { color: 'var(--status-waiting)', label: 'Connecting...' },
  connected: { color: 'var(--status-idle)', label: 'Connected' },
  disconnected: { color: 'var(--status-error)', label: 'Disconnected' },
} as const;

export function StatusBar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sessionStatus = useAppStore((s) => s.sessionStatus);
  const instances = useInstanceStore((s) => s.instances);
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);
  const connectionStatus = useAppStore((s) => {
    if (!activeInstanceId) {
      return s.connectionStatus;
    }
    return s.instanceConnectionStatus[activeInstanceId] ?? 'disconnected';
  });

  const statusCfg = STATUS_CONFIG[sessionStatus];
  const connCfg = CONNECTION_CONFIG[connectionStatus];
  const activeInstance = instances.find(i => i.instanceId === activeInstanceId);
  const instanceName = activeInstance?.name;

  return (
    <>
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
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
          overflow: 'hidden',
          flex: '1 1 auto',
        }}>
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            flexShrink: 0,
          }}>
            Claude Remote
          </span>
          {instanceName && (
            <span
              title={instanceName}
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
                maxWidth: '200px',
              }}
            >
              / {instanceName}
            </span>
          )}
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
          {/* 设置按钮 */}
          <button
            onClick={() => setSettingsOpen(true)}
            title="设置"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            ⚙
          </button>
        </div>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onConfigSaved={notifyConfigChanged} />
    </>
  );
}
