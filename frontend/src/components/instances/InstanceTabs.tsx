import { useInstanceStore } from '../../stores/instance-store.js';

interface InstanceTabsProps {
  onSwitch: (instanceId: string) => void;
}

export function InstanceTabs({ onSwitch }: InstanceTabsProps) {
  const instances = useInstanceStore((s) => s.instances);
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);

  // 只有一个实例时隐藏 Tab 栏
  if (instances.length <= 1) {
    return null;
  }

  return (
    <div style={{
      display: 'flex',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      overflowX: 'auto',
      flexShrink: 0,
    }}>
      {instances.map((inst) => {
        const isActive = inst.instanceId === activeInstanceId;
        return (
          <button
            key={inst.instanceId}
            onClick={() => onSwitch(inst.instanceId)}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--accent-color, #007aff)' : '2px solid transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {inst.name}
            <span style={{
              marginLeft: 6,
              fontSize: 11,
              color: 'var(--text-tertiary, var(--text-secondary))',
              opacity: 0.7,
            }}>
              :{inst.port}
            </span>
          </button>
        );
      })}
    </div>
  );
}
