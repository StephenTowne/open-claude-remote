import { useState, useRef, useEffect, useCallback } from 'react';
import { useInstanceStore } from '../../stores/instance-store.js';
import { fetchInstances } from '../../services/instance-api.js';
import { CreateInstanceModal } from './CreateInstanceModal.js';
import type { InstanceInfo } from '#shared';

interface InstanceTabsProps {
  onSwitch: (instanceId: string) => void;
  onCopySuccess?: (newInstanceName: string) => void;
}

/** Clamp context menu position so it stays within the viewport */
function clampMenuPosition(x: number, y: number, menuWidth = 140, menuHeight = 44) {
  const maxX = window.innerWidth - menuWidth - 8;
  const maxY = window.innerHeight - menuHeight - 8;
  return {
    x: Math.max(8, Math.min(x, maxX)),
    y: Math.max(8, Math.min(y, maxY)),
  };
}

export function InstanceTabs({ onSwitch, onCopySuccess }: InstanceTabsProps) {
  const instances = useInstanceStore((s) => s.instances);
  const setInstances = useInstanceStore((s) => s.setInstances);
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [copySource, setCopySource] = useState<InstanceInfo | null>(null);

  // 长按菜单状态
  const [contextMenuInstance, setContextMenuInstance] = useState<InstanceInfo | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  // 始终显示 tabs，让用户可以长按复制

  // 点击菜单外部关闭
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenuInstance(null);
    };
    if (contextMenuInstance) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenuInstance]);

  // 长按开始 — 立即提取坐标，避免 setTimeout 中访问已过期的 touch 事件
  const handleTouchStart = (inst: InstanceInfo, e: React.TouchEvent) => {
    longPressFiredRef.current = false;
    const { clientX, clientY } = e.touches[0];
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setContextMenuPosition(clampMenuPosition(clientX, clientY));
      setContextMenuInstance(inst);
    }, 500);
  };

  // 长按结束（取消）
  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Tab 点击 — 长按触发后跳过
  const handleTabClick = useCallback((instanceId: string) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    onSwitch(instanceId);
  }, [onSwitch]);

  // 右键菜单（桌面端）
  const handleContextMenu = (inst: InstanceInfo, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPosition(clampMenuPosition(e.clientX, e.clientY));
    setContextMenuInstance(inst);
  };

  // 复制实例
  const handleCopy = () => {
    if (contextMenuInstance) {
      setCopySource(contextMenuInstance);
      setIsCreateModalOpen(true);
      setContextMenuInstance(null);
    }
  };

  const handleCreateSuccess = async (newInstanceName: string) => {
    // 轮询获取新实例（每 1s 一次，最多 5 次）
    const maxAttempts = 5;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        const updatedInstances = await fetchInstances();
        // 按 startedAt 倒序找最新的同名实例，避免重名歧义
        const found = [...updatedInstances]
          .filter(inst => inst.name === newInstanceName)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
        if (found) {
          setInstances(updatedInstances);
          // 复制模式：通知父组件切换实例
          if (copySource && onCopySuccess) {
            onCopySuccess(newInstanceName);
          }
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

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setCopySource(null);
  };

  return (
    <>
      <div
        data-testid="instance-tabs"
        style={{
          display: 'flex',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        {/* Tab 列表 - 可滚动区域 */}
        <div
          style={{
            display: 'flex',
            overflowX: 'auto',
            padding: '0 4px 0 16px',
            flex: 1,
          }}
        >
          {instances.map((inst) => {
            const isActive = inst.instanceId === activeInstanceId;
            return (
              <button
                key={inst.instanceId}
                data-testid="instance-tab"
                onClick={() => handleTabClick(inst.instanceId)}
                onTouchStart={(e) => handleTouchStart(inst, e)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
                onContextMenu={(e) => handleContextMenu(inst, e)}
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

        {/* 固定的 "+" 按钮 */}
        <button
          onClick={() => setIsCreateModalOpen(true)}
          aria-label="Create new instance"
          style={{
            width: 44,
            height: 44,
            padding: 0,
            background: 'transparent',
            border: 'none',
            borderLeft: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            fontSize: 22,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          +
        </button>
      </div>

      {/* 长按/右键菜单 */}
      {contextMenuInstance && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
            zIndex: 1100,
            background: 'var(--bg-secondary)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
            minWidth: 140,
          }}
        >
          <button
            onClick={handleCopy}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            Copy Instance
          </button>
        </div>
      )}

      {/* 创建实例模态框 */}
      <CreateInstanceModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleCreateSuccess}
        copySource={copySource}
      />
    </>
  );
}
