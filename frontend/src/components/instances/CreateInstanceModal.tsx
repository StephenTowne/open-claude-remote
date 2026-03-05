import { useState, useEffect, useRef } from 'react';
import { getInstanceConfig, createInstance, type InstanceConfigResponse } from '../../services/instance-create-api.js';
import { WorkspaceSelector } from '../common/WorkspaceSelector.js';
import { SettingsFileSelector } from '../common/SettingsFileSelector.js';
import { BottomSheet } from '../common/BottomSheet.js';
import type { SettingsFile, InstanceInfo } from '#shared';

interface CreateInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newInstanceName: string) => void;
  copySource?: InstanceInfo | null;
}

export function CreateInstanceModal({ isOpen, onClose, onSuccess, copySource }: CreateInstanceModalProps) {
  const [config, setConfig] = useState<InstanceConfigResponse | null>(null);
  const [cwd, setCwd] = useState('');
  const [name, setName] = useState('');
  const [settingsFile, setSettingsFile] = useState('');
  const [claudeArgs, setClaudeArgs] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingSettingsPathRef = useRef<string | null>(null);

  // 加载配置
  useEffect(() => {
    if (isOpen) {
      loadConfig(!!copySource);
      // 重置表单
      setCwd('');
      setName('');
      setSettingsFile('');
      setClaudeArgs('');
      setError(null);
      pendingSettingsPathRef.current = null;

      // 复制模式：预填源实例参数
      if (copySource) {
        setCwd(copySource.cwd);
        setName(`${copySource.name}-copy`);

        // 解析 claudeArgs
        if (copySource.claudeArgs && copySource.claudeArgs.length > 0) {
          const args = [...copySource.claudeArgs];

          // 找到 --settings 参数
          const settingsIdx = args.indexOf('--settings');
          if (settingsIdx !== -1 && settingsIdx + 1 < args.length) {
            // 暂存路径，等 config 加载后再匹配 settingsFiles
            pendingSettingsPathRef.current = args[settingsIdx + 1];
            args.splice(settingsIdx, 2); // 移除 --settings 和路径
          }

          setClaudeArgs(args.join(' '));
        }
      }
    }
  }, [isOpen, copySource]);

  // config 加载后匹配 pending settings path
  useEffect(() => {
    if (config && pendingSettingsPathRef.current) {
      const matched = config.settingsFiles.find(
        sf => `${sf.directoryPath}/${sf.filename}` === pendingSettingsPathRef.current
      );
      if (matched) {
        setSettingsFile(matched.filename);
      }
      pendingSettingsPathRef.current = null;
    }
  }, [config]);

  const loadConfig = async (isCopyMode: boolean) => {
    try {
      const cfg = await getInstanceConfig();
      setConfig(cfg);
      // 复制模式下不覆盖已预填的 claudeArgs
      if (!isCopyMode && cfg.claudeArgs.length > 0) {
        setClaudeArgs(cfg.claudeArgs.join(' '));
      }
    } catch (err) {
      console.error('Failed to load instance config:', err);
      setError('Failed to load configuration');
    }
  };

  const handleSubmit = async () => {
    if (!cwd) {
      setError('Please select a working directory');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 构建 claudeArgs
      const args: string[] = [];

      // 如果选择了 settings 文件，添加 --settings 参数
      if (settingsFile && config) {
        // 根据 filename 找到选中的 SettingsFile
        const selected = config.settingsFiles.find(
          (sf: SettingsFile) => sf.filename === settingsFile
        );
        if (selected) {
          // 使用 directoryPath 构建完整路径
          args.push('--settings', `${selected.directoryPath}/${selected.filename}`);
        }
      }

      // 添加用户手动输入的其他参数
      if (claudeArgs.trim()) {
        args.push(...claudeArgs.trim().split(/\s+/).filter(Boolean));
      }

      await createInstance({
        cwd,
        name: name.trim() || undefined,
        claudeArgs: args.length > 0 ? args : undefined,
      });

      // 计算新实例名称（与 instance-spawner.ts 逻辑一致）
      const newInstanceName = name.trim() || cwd.split('/').pop() || 'unknown';
      onSuccess(newInstanceName);
      onClose();
    } catch (err) {
      console.error('Failed to create instance:', err);
      setError(err instanceof Error ? err.message : 'Failed to create instance');
    } finally {
      setLoading(false);
    }
  };

  const hasWorkspaces = config && config.workspaces.length > 0;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={copySource ? 'Copy Instance' : 'Create New Instance'}
      footer={
        <div style={{
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
            Cancel
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
            {loading ? (copySource ? 'Copying…' : 'Creating…') : (copySource ? 'Copy' : 'Create')}
          </button>
        </div>
      }
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        paddingBottom: 16,
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
            Working Directory *
          </label>
          <WorkspaceSelector
            id="cwd-select"
            workspaces={config?.workspaces ?? []}
            value={cwd}
            onChange={setCwd}
            placeholder="Select working directory…"
            disabled={!hasWorkspaces}
          />
          {!hasWorkspaces && (
            <p style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              marginTop: 6,
              opacity: 0.8,
            }}>
              Please configure workspaces in the config file first, or start an instance via CLI.
            </p>
          )}
        </div>

        {/* 实例名称 */}
        <div>
          <label htmlFor="instance-name" style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 6,
            color: 'var(--text-secondary)',
          }}>
            Instance Name (optional)
          </label>
          <input
            id="instance-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            placeholder="Defaults to working directory name"
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

        {/* Settings 文件选择器 */}
        {config && config.settingsFiles.length > 0 && (
          <div>
            <label htmlFor="settings-select" style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 6,
              color: 'var(--text-secondary)',
            }}>
              Settings File (optional)
            </label>
            <SettingsFileSelector
              id="settings-select"
              settingsFiles={config.settingsFiles}
              value={settingsFile}
              onChange={setSettingsFile}
              placeholder="None"
            />
            <p style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              marginTop: 4,
              opacity: 0.7,
            }}>
              Custom Claude settings from ~/.claude/ or ~/.claude-remote/settings/
            </p>
          </div>
        )}

        {/* Claude 参数 */}
        <div>
          <label htmlFor="claude-args" style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 6,
            color: 'var(--text-secondary)',
          }}>
            Claude Arguments (optional)
          </label>
          <input
            id="claude-args"
            type="text"
            value={claudeArgs}
            onChange={(e) => setClaudeArgs(e.target.value)}
            autoComplete="off"
            placeholder="e.g., chat --model claude-sonnet-4-6"
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
            Multiple arguments separated by spaces (quoted arguments with spaces not supported)
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
    </BottomSheet>
  );
}