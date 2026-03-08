import { useState, useEffect, useRef } from 'react';
import { ShortcutSettings } from './ShortcutSettings.js';
import { CommandSettings } from './CommandSettings.js';
import { NotificationSettings } from './NotificationSettings.js';
import { getUserConfig, updateUserConfig, updateNotificationChannelEnabled } from '../../services/api-client.js';
import { DEFAULT_SHORTCUTS, DEFAULT_COMMANDS, type UserConfig, type ConfigurableShortcut, type ConfigurableCommand } from '../../config/commands.js';
import { DINGTALK_WEBHOOK_PATTERN, SENDKEY_PATTERN, type SafeNotificationConfigs } from '#shared';
import { BottomSheet } from '../common/BottomSheet.js';
import { useInstanceStore } from '../../stores/instance-store.js';
import { useAppStore } from '../../stores/app-store.js';

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
  const [wechatWorkSendKey, setWechatWorkSendKey] = useState('');
  const [notificationStatus, setNotificationStatus] = useState<SafeNotificationConfigs>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const activeInstanceId = useInstanceStore((state) => state.activeInstanceId);
  const showToast = useAppStore((s) => s.showToast);
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
      const { config } = await getUserConfig(activeInstanceId ?? undefined);
      if (config) {
        setShortcuts(config.shortcuts.map(s => withId(s)));
        setCommands(config.commands.map(c => withId(c)));
        // 使用 notifications 结构
        const status: SafeNotificationConfigs = config.notifications || {};
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

  /**
   * 处理通知渠道启用状态变更
   * 即时生效，无需点击 Save
   */
  const handleChannelEnabledChange = async (channel: 'dingtalk' | 'wechat_work', enabled: boolean) => {
    // 乐观更新：立即切换 Toggle 状态
    const prevStatus = notificationStatus;
    setNotificationStatus((prev) => ({
      ...prev,
      [channel]: { ...prev[channel], configured: true, enabled },
    }));

    const channelName = channel === 'dingtalk' ? 'DingTalk' : 'WeChat Work';

    try {
      await updateNotificationChannelEnabled(channel, enabled);
      showToast(`${channelName} notifications ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      // 失败回滚
      setNotificationStatus(prevStatus);
      console.error('Failed to update channel enabled status:', err);
      setError(`Failed to update ${channelName.toLowerCase()}`);
      showToast(`Failed to update ${channelName.toLowerCase()}`);
      setTimeout(() => setError(null), 2000);
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

      // 构建通知配置：只在用户实际输入了新 URL 时才发送对应渠道
      const notifications: NonNullable<UserConfig['notifications']> = {};

      // 钉钉配置：仅在用户输入了新 URL 时包含
      const trimmedUrl = dingtalkWebhookUrl.trim();
      if (trimmedUrl) {
        if (!DINGTALK_WEBHOOK_PATTERN.test(trimmedUrl)) {
          setError('Please enter a valid DingTalk Webhook URL (starting with https://oapi.dingtalk.com/robot/send?access_token=)');
          setSaving(false);
          return;
        }
        notifications.dingtalk = { webhookUrl: trimmedUrl };
      }

      // 微信配置：仅在用户输入了新 SendKey 时包含
      const trimmedSendKey = wechatWorkSendKey.trim();
      if (trimmedSendKey) {
        if (!SENDKEY_PATTERN.test(trimmedSendKey)) {
          setError('Please enter a valid SendKey (starts with SCT, at least 13 characters)');
          setSaving(false);
          return;
        }
        notifications.wechat_work = { sendKey: trimmedSendKey };
      }

      // 如果有通知配置变更，添加到 config
      if (Object.keys(notifications).length > 0) {
        config.notifications = notifications;
      }

      const ok = await updateUserConfig(config, activeInstanceId ?? undefined);
      if (ok) {
        setSuccess(true);
        // 仅更新有新 URL 输入的渠道状态，保留已有 configured/enabled
        const newStatus: SafeNotificationConfigs = { ...notificationStatus };
        if (trimmedUrl) {
          newStatus.dingtalk = { ...notificationStatus?.dingtalk, configured: true, enabled: notificationStatus?.dingtalk?.enabled };
          setDingtalkWebhookUrl(''); // 保存后清空输入框
        }
        if (trimmedSendKey) {
          newStatus.wechat_work = { ...notificationStatus?.wechat_work, configured: true, enabled: notificationStatus?.wechat_work?.enabled };
          setWechatWorkSendKey(''); // 保存后清空输入框
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
          wechatWorkSendKey={wechatWorkSendKey}
          onWechatWorkSendKeyChange={setWechatWorkSendKey}
          onChannelEnabledChange={handleChannelEnabledChange}
        />
      )}
    </BottomSheet>
  );
}