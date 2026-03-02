import { useState, useEffect } from 'react';
import { getInstanceConfig, createInstance, type InstanceConfigResponse } from '../../services/instance-create-api.js';
import { WorkspaceSelector } from '../common/WorkspaceSelector.js';

interface CreateInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newInstanceName: string) => void;
}

export function CreateInstanceModal({ isOpen, onClose, onSuccess }: CreateInstanceModalProps) {
  const [config, setConfig] = useState<InstanceConfigResponse | null>(null);
  const [cwd, setCwd] = useState('');
  const [name, setName] = useState('');
  const [claudeArgs, setClaudeArgs] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载配置
  useEffect(() => {
    if (isOpen) {
      loadConfig();
      // 重置表单
      setCwd('');
      setName('');
      setClaudeArgs('');
      setError(null);
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const cfg = await getInstanceConfig();
      setConfig(cfg);
      // 设置默认 Claude 参数
      if (cfg.defaultClaudeArgs.length > 0) {
        setClaudeArgs(cfg.defaultClaudeArgs.join(' '));
      }
    } catch (err) {
      console.error('Failed to load instance config:', err);
      setError('加载配置失败');
    }
  };

  const handleSubmit = async () => {
    if (!cwd) {
      setError('请选择工作目录');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const args = claudeArgs.trim()
        ? claudeArgs.split(/\s+/).filter(Boolean)
        : undefined;

      await createInstance({
        cwd,
        name: name.trim() || undefined,
        claudeArgs: args,
      });

      // 计算新实例名称（与 instance-spawner.ts 逻辑一致）
      const newInstanceName = name.trim() || cwd.split('/').pop() || 'unknown';
      onSuccess(newInstanceName);
      onClose();
    } catch (err) {
      console.error('Failed to create instance:', err);
      setError(err instanceof Error ? err.message : '创建实例失败');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const hasWorkspaces = config && config.workspaces.length > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90%',
          maxWidth: 480,
          maxHeight: '80vh',
          borderRadius: 12,
          background: 'var(--bg-secondary)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 头部 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            创建新实例
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 20,
              cursor: 'pointer',
            }}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* 内容区 */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {/* 工作目录选择 */}
          <div>
            <label htmlFor="cwd-select" style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 6,
              color: 'var(--text-secondary)',
            }}>
              工作目录 *
            </label>
            <WorkspaceSelector
              id="cwd-select"
              workspaces={config?.workspaces ?? []}
              value={cwd}
              onChange={setCwd}
              placeholder="选择工作目录…"
              disabled={!hasWorkspaces}
            />
            {!hasWorkspaces && (
              <p style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginTop: 6,
                opacity: 0.8,
              }}>
                请先在配置文件中设置 workspaces，或通过 CLI 启动一个实例。
              </p>
            )}
          </div>

          {/* 实例名称 */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 6,
              color: 'var(--text-secondary)',
            }}>
              实例名称（可选）
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="默认为工作目录名"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Claude 参数 */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 6,
              color: 'var(--text-secondary)',
            }}>
              Claude 参数（可选）
            </label>
            <input
              type="text"
              value={claudeArgs}
              onChange={(e) => setClaudeArgs(e.target.value)}
              placeholder="例如: chat --model claude-sonnet-4-6"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
            <p style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              marginTop: 4,
              opacity: 0.7,
            }}>
              多个参数用空格分隔（不支持引号包裹含空格的参数）
            </p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(255, 59, 48, 0.1)',
              color: 'var(--status-error)',
              fontSize: 13,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 8,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !hasWorkspaces}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: 'none',
              background: loading || !hasWorkspaces ? 'var(--bg-tertiary)' : 'var(--status-running)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading || !hasWorkspaces ? 'default' : 'pointer',
              opacity: loading || !hasWorkspaces ? 0.7 : 1,
            }}
          >
            {loading ? '创建中…' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}