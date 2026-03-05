import { useState, useEffect, useRef } from 'react';
import { ShortcutSettings } from './ShortcutSettings.js';
import { CommandSettings } from './CommandSettings.js';
import { NotificationSettings } from './NotificationSettings.js';
import { getUserConfig, updateUserConfig } from '../../services/api-client.js';
import { DEFAULT_SHORTCUTS, DEFAULT_COMMANDS, type UserConfig, type ConfigurableShortcut, type ConfigurableCommand } from '../../config/commands.js';
import { DINGTALK_WEBHOOK_PATTERN, WECHAT_WORK_SENDKEY_PATTERN, type SafeNotificationConfigs } from '#shared';
import { BottomSheet } from '../common/BottomSheet.js';

export type WithId<T> = T & { _id: string };

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

type TabType = 'shortcuts' | 'commands' | 'notifications';

export function SettingsModal({ isOpen, onClose, onConfigSaved }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('shortcuts');
  const [shortcuts, setShortcuts] = useState<WithId<ConfigurableShortcut>[]>([]);
  const [commands, setCommands] = useState<WithId<ConfigurableCommand>[]>([]);
  const [dingtalkWebhookUrl, setDingtalkWebhookUrl] = useState('');
  const [wechatWorkSendkey, setWechatWorkSendkey] = useState('');
  const [notificationStatus, setNotificationStatus] = useState<SafeNotificationConfigs>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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

  const loadConfig = async () => {
    try {
      const { config } = await getUserConfig();
      if (config) {
        setShortcuts(config.shortcuts.map(s => withId(s)));
        setCommands(config.commands.map(c => withId(c)));
        // 优先使用新版 notifications 结构，回退到旧版 dingtalk
        const status: SafeNotificationConfigs = config.notifications || {
          dingtalk: config.dingtalk,
        };
        setNotificationStatus(status);
        setDingtalkWebhookUrl(''); // 不暴露已有 URL，用户需要重新输入才能更改
      } else {
        // 使用默认配置
        setShortcuts(DEFAULT_SHORTCUTS.map(s => withId({ ...s, enabled: true })));
        setCommands(DEFAULT_COMMANDS.map(c => withId({ ...c, enabled: true })));
        setNotificationStatus({});
        setDingtalkWebhookUrl('');
      }
    } catch (err) {
      setError('Failed to load configuration');
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

      // 构建通知配置
      const notifications: NonNullable<UserConfig['notifications']> = {};

      // 钉钉配置
      const trimmedUrl = dingtalkWebhookUrl.trim();
      if (trimmedUrl || notificationStatus?.dingtalk?.configured) {
        if (trimmedUrl && !DINGTALK_WEBHOOK_PATTERN.test(trimmedUrl)) {
          setError('Please enter a valid DingTalk Webhook URL (starting with https://oapi.dingtalk.com/robot/send?access_token=)');
          setSaving(false);
          return;
        }
        notifications.dingtalk = { webhookUrl: trimmedUrl };
      }

      // 微信配置
      const trimmedSendkey = wechatWorkSendkey.trim();
      if (trimmedSendkey || notificationStatus?.wechat_work?.configured) {
        if (trimmedSendkey && !WECHAT_WORK_SENDKEY_PATTERN.test(trimmedSendkey)) {
          setError('Please enter a valid WeChat Sendkey (starting with SCT or sctp)');
          setSaving(false);
          return;
        }
        notifications.wechat_work = { sendkey: trimmedSendkey };
      }

      // 如果有通知配置，添加到 config
      if (Object.keys(notifications).length > 0) {
        config.notifications = notifications;
      }

      const ok = await updateUserConfig(config);
      if (ok) {
        setSuccess(true);
        // 更新已配置状态
        const newStatus: SafeNotificationConfigs = { ...notificationStatus };
        if (trimmedUrl || notificationStatus?.dingtalk?.configured) {
          newStatus.dingtalk = { configured: !!trimmedUrl };
          if (trimmedUrl) {
            setDingtalkWebhookUrl(''); // 保存后清空输入框
          }
        }
        if (trimmedSendkey || notificationStatus?.wechat_work?.configured) {
          newStatus.wechat_work = { configured: !!trimmedSendkey };
          if (trimmedSendkey) {
            setWechatWorkSendkey(''); // 保存后清空输入框
          }
        }
        setNotificationStatus(newStatus);
        onConfigSaved?.();
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setError('Failed to save');
      }
    } catch (err) {
      setError('Failed to save');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      footer={
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{ fontSize: 13 }}>
            {error && <span style={{ color: 'var(--status-error)' }}>{error}</span>}
            {success && <span style={{ color: 'var(--status-running)' }}>Saved</span>}
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
              Cancel
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
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      }
    >
      {/* Tab 切换 */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        margin: '0 -16px',
        marginBottom: 16,
      }}>
        {(['shortcuts', 'commands', 'notifications'] as TabType[]).map((tab) => (
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
            {tab === 'shortcuts' ? 'Shortcuts' : tab === 'commands' ? 'Commands' : 'Notifications'}
          </button>
        ))}
      </div>

      {activeTab === 'shortcuts' ? (
        <ShortcutSettings
          shortcuts={shortcuts}
          onChange={setShortcuts}
        />
      ) : activeTab === 'commands' ? (
        <CommandSettings
          commands={commands}
          onChange={setCommands}
        />
      ) : (
        <NotificationSettings
          notificationStatus={notificationStatus}
          dingtalkWebhookUrl={dingtalkWebhookUrl}
          onDingtalkWebhookChange={setDingtalkWebhookUrl}
          wechatWorkSendkey={wechatWorkSendkey}
          onWechatWorkSendkeyChange={setWechatWorkSendkey}
        />
      )}
    </BottomSheet>
  );
}