import { useState, useEffect, useRef, useMemo } from 'react';
import { getInstanceConfig, createInstance, type InstanceConfigResponse } from '../../services/instance-create-api.js';
import { ActionSheetSelect, type ActionSheetOption } from '../common/ActionSheetSelect.js';
import { BottomSheet } from '../common/BottomSheet.js';
import type { SettingsFile, InstanceInfo } from '#shared';

interface CreateInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newInstanceName: string) => void;
  copySource?: InstanceInfo | null;
}

/**
 * 从完整路径中提取目录名
 */
function getDirectoryName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
}

/**
 * 获取智能显示的父目录路径
 * 例如：/Users/tom/projects/claude-code-remote -> .../projects
 */
function getParentPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 1) {
    return path;
  }
  return '.../' + parts[parts.length - 2];
}

/**
 * SVG 文件夹图标
 */
function FolderIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0, color: 'var(--text-secondary)' }}
    >
      <path
        d="M2 4C2 3.44772 2.44772 3 3 3H6.17157C6.43678 3 6.69114 3.10536 6.87868 3.29289L7.58579 4H13C13.5523 4 14 4.44772 14 5V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V4Z"
        fill="currentColor"
        opacity="0.6"
      />
      <path
        d="M2 5.5V12C2 12.5523 2.44772 13 3 13H13C13.5523 13 14 12.5523 14 12V5.5C14 5.22386 13.7761 5 13.5 5H2.5C2.22386 5 2 5.22386 2 5.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * SVG 设置图标（齿轮）
 */
function SettingsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0, color: 'var(--text-secondary)' }}
    >
      <path
        d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M12.9247 8.99999C12.9692 8.66999 13 8.33749 13 7.99999C13 7.66249 12.9692 7.32999 12.9247 6.99999L14.3622 5.91249C14.4872 5.81249 14.5197 5.63749 14.4372 5.48749L13.0622 3.01249C12.9797 2.86249 12.8122 2.81249 12.6622 2.86249L10.9247 3.51249C10.4247 3.13749 9.87468 2.82499 9.28718 2.58749L9.01218 0.787487C8.98718 0.624987 8.84968 0.499987 8.68718 0.499987H5.93718C5.77468 0.499987 5.63718 0.624987 5.61218 0.787487L5.33718 2.58749C4.74968 2.82499 4.19968 3.14999 3.69968 3.51249L1.96218 2.86249C1.81218 2.81249 1.64468 2.86249 1.56218 3.01249L0.187178 5.49999C0.099678 5.64999 0.137178 5.82499 0.262178 5.92499L1.69968 6.99999C1.65518 7.32999 1.62468 7.66249 1.62468 7.99999C1.62468 8.33749 1.65518 8.66999 1.69968 8.99999L0.262178 10.0875C0.137178 10.1875 0.104678 10.3625 0.187178 10.5125L1.56218 12.9875C1.64468 13.1375 1.81218 13.1875 1.96218 13.1375L3.69968 12.4875C4.19968 12.8625 4.74968 13.175 5.33718 13.4125L5.61218 15.2125C5.63718 15.375 5.77468 15.5 5.93718 15.5H8.68718C8.84968 15.5 8.98718 15.375 9.01218 15.2125L9.28718 13.4125C9.87468 13.175 10.4247 12.85 10.9247 12.4875L12.6622 13.1375C12.8122 13.1875 12.9797 13.1375 13.0622 12.9875L14.4372 10.5C14.5197 10.35 14.4872 10.175 14.3622 10.075L12.9247 8.99999ZM8 10.5C6.62468 10.5 5.49968 9.37499 5.49968 7.99999C5.49968 6.62499 6.62468 5.49999 8 5.49999C9.37532 5.49999 10.5003 6.62499 10.5003 7.99999C10.5003 9.37499 9.37532 10.5 8 10.5Z"
        fill="currentColor"
        opacity="0.8"
      />
    </svg>
  );
}

/**
 * SVG "None" 选项图标（横线）
 */
function NoneIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0, color: 'var(--text-secondary)' }}
    >
      <path
        d="M3 8H13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
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

  // 将 workspaces 转换为 ActionSheetOption 格式
  const workspaceOptions: ActionSheetOption<string>[] = useMemo(() => {
    if (!config) return [];
    return config.workspaces.map((ws) => ({
      value: ws,
      label: getDirectoryName(ws),
      description: getParentPath(ws),
      icon: <FolderIcon />,
    }));
  }, [config]);

  // 将 settingsFiles 转换为 ActionSheetOption 格式（包含 "None" 选项）
  const settingsOptions: ActionSheetOption<string>[] = useMemo(() => {
    if (!config) return [];
    const items: ActionSheetOption<string>[] = [
      { value: '', label: 'None', icon: <NoneIcon /> },
    ];
    config.settingsFiles.forEach((sf) => {
      items.push({
        value: sf.filename,
        label: sf.displayName,
        description: sf.directory,
        icon: <SettingsIcon />,
      });
    });
    return items;
  }, [config]);

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
          <ActionSheetSelect
            id="cwd-select"
            options={workspaceOptions}
            value={cwd || null}
            onChange={setCwd}
            placeholder="Select working directory…"
            searchPlaceholder="Search directories…"
            emptyMessage="No workspaces available"
            disabled={!hasWorkspaces}
            triggerIcon={<FolderIcon />}
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
            <ActionSheetSelect
              id="settings-select"
              options={settingsOptions}
              value={settingsFile || null}
              onChange={setSettingsFile}
              placeholder="None"
              searchPlaceholder="Search settings files…"
              triggerIcon={<SettingsIcon />}
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