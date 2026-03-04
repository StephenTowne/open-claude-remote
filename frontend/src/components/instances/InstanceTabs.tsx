import { useState } from 'react';
import { useInstanceStore } from '../../stores/instance-store.js';
import { fetchInstances } from '../../services/instance-api.js';
import { CreateInstanceModal } from './CreateInstanceModal.js';

interface InstanceTabsProps {
  onSwitch: (instanceId: string) => void;
}

export function InstanceTabs({ onSwitch }: InstanceTabsProps) {
  const instances = useInstanceStore((s) => s.instances);
  const setInstances = useInstanceStore((s) => s.setInstances);
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const showTabs = instances.length > 1;

  const handleCreateSuccess = async (newInstanceName: string) => {
    // 轮询获取新实例（每 1s 一次，最多 5 次）
    const maxAttempts = 5;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        const updatedInstances = await fetchInstances();
        const found = updatedInstances.find(inst => inst.name === newInstanceName);
        if (found) {
          setInstances(updatedInstances);
          return;
        }
      } catch (err) {
        console.error('[InstanceTabs] Failed to fetch instances:', err);
      }
    }
    // 超时后仍然刷新一次
    try {
      const updatedInstances = await fetchInstances();
      setInstances(updatedInstances);
    } catch {
      // 忽略错误
    }
  };

  return (
    <>
      <div style={{
        display: 'flex',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        overflowX: 'auto',
        flexShrink: 0,
      }}>
        {/* Tab 列表 */}
        {showTabs && instances.map((inst) => {
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

        {/* "+" 按钮 */}
        <button
          onClick={() => setIsCreateModalOpen(true)}
          aria-label="Create new instance"
          style={{
            padding: '10px 16px',
            background: 'transparent',
            border: 'none',
            borderLeft: showTabs ? '1px solid var(--border-color)' : 'none',
            color: 'var(--text-secondary)',
            fontSize: 20,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            marginLeft: showTabs ? 'auto' : 0,
          }}
        >
          +
        </button>
      </div>

      {/* 创建实例模态框 */}
      <CreateInstanceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
}
