import { useState, useEffect, useRef } from 'react';
import { ShortcutSettings } from './ShortcutSettings.js';
import { CommandSettings } from './CommandSettings.js';
import { getUserConfig, updateUserConfig } from '../../services/api-client.js';
import { DEFAULT_SHORTCUTS, DEFAULT_COMMANDS, type UserConfig, type ConfigurableShortcut, type ConfigurableCommand } from '../../config/commands.js';

export type WithId<T> = T & { _id: string };

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

type TabType = 'shortcuts' | 'commands';

export function SettingsModal({ isOpen, onClose, onConfigSaved }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('shortcuts');
  const [shortcuts, setShortcuts] = useState<WithId<ConfigurableShortcut>[]>([]);
  const [commands, setCommands] = useState<WithId<ConfigurableCommand>[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const idCounter = useRef(0);

  function nextId(): string {
    return String(++idCounter.current);
  }

  function withId<T>(item: T): WithId<T> {
    return { ...item, _id: nextId() };
  }

  // 加载配置
  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  // 抽屉动画状态管理
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // 双重 rAF 确保浏览器先渲染 translateY(100%) 的初始帧，再过渡到 translateY(0)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimating(true));
      });
    } else if (isVisible) {
      setIsAnimating(false);
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isVisible]);

  const loadConfig = async () => {
    try {
      const { config } = await getUserConfig();
      if (config) {
        setShortcuts(config.shortcuts.map(s => withId(s)));
        setCommands(config.commands.map(c => withId(c)));
      } else {
        // 使用默认配置
        setShortcuts(DEFAULT_SHORTCUTS.map(s => withId({ ...s, enabled: true })));
        setCommands(DEFAULT_COMMANDS.map(c => withId({ ...c, enabled: true })));
      }
    } catch (err) {
      setError('加载配置失败');
      console.error(err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // 保存时剥离 _id 字段
      const config: UserConfig = {
        shortcuts: shortcuts.map(({ _id: _, ...rest }) => rest),
        commands: commands.map(({ _id: _, ...rest }) => rest),
      };
      const ok = await updateUserConfig(config);
      if (ok) {
        setSuccess(true);
        onConfigSaved?.();
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setError('保存失败');
      }
    } catch (err) {
      setError('保存失败');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: isAnimating ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '85vh',
          borderRadius: '16px 16px 0 0',
          background: 'var(--bg-secondary)',
          boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: isAnimating ? 'translateY(0)' : 'translateY(100%)',
          paddingBottom: 'var(--safe-bottom)',
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
            设置
          </h2>
          <button
            onClick={onClose}
            aria-label="关闭"
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
          >
            ×
          </button>
        </div>

        {/* Tab 切换 */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
        }}>
          {(['shortcuts', 'commands'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: 'none',
                background: 'transparent',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === tab ? '2px solid var(--status-running)' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: activeTab === tab ? 600 : 400,
              }}
            >
              {tab === 'shortcuts' ? '快捷键' : '命令'}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
        }}>
          {activeTab === 'shortcuts' ? (
            <ShortcutSettings
              shortcuts={shortcuts}
              onChange={setShortcuts}
            />
          ) : (
            <CommandSettings
              commands={commands}
              onChange={setCommands}
            />
          )}
        </div>

        {/* 底部操作栏 */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{ fontSize: 13 }}>
            {error && <span style={{ color: 'var(--status-error)' }}>{error}</span>}
            {success && <span style={{ color: 'var(--status-running)' }}>已保存</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
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
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '8px 20px',
                borderRadius: 6,
                border: 'none',
                background: saving ? 'var(--bg-tertiary)' : 'var(--status-running)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}