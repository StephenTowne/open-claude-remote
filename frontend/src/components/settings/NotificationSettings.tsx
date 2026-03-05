import { useState } from 'react';
import type { NotificationChannelType, SafeNotificationConfigs } from '#shared';
import { NotificationChannelCard } from './NotificationChannelCard.js';
import { DingtalkConfigForm } from './DingtalkConfigForm.js';
import { WechatWorkConfigForm } from './WechatWorkConfigForm.js';

interface NotificationSettingsProps {
  notificationStatus?: SafeNotificationConfigs;
  dingtalkWebhookUrl: string;
  onDingtalkWebhookChange: (url: string) => void;
  wechatWorkApiUrl: string;
  onWechatWorkApiUrlChange: (apiUrl: string) => void;
  /** 通知渠道启用状态变更回调 */
  onChannelEnabledChange?: (channel: 'dingtalk' | 'wechat_work', enabled: boolean) => void;
}

export function NotificationSettings({
  notificationStatus,
  dingtalkWebhookUrl,
  onDingtalkWebhookChange,
  wechatWorkApiUrl,
  onWechatWorkApiUrlChange,
  onChannelEnabledChange,
}: NotificationSettingsProps) {
  // 默认展开已配置的渠道，或默认展开第一个
  const [expandedChannel, setExpandedChannel] = useState<NotificationChannelType | null>('dingtalk');

  const handleToggle = (channel: NotificationChannelType) => {
    setExpandedChannel((current) => (current === channel ? null : channel));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 说明文字 */}
      <div
        style={{
          padding: 12,
          background: 'var(--bg-tertiary)',
          borderRadius: 8,
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}
      >
        Configure notification channels to receive alerts when Claude needs your attention.
      </div>

      {/* 渠道列表 */}
      <NotificationChannelCard
        channelType="dingtalk"
        status={notificationStatus?.dingtalk}
        isExpanded={expandedChannel === 'dingtalk'}
        onToggle={() => handleToggle('dingtalk')}
        onEnabledChange={
          notificationStatus?.dingtalk?.configured
            ? (enabled) => onChannelEnabledChange?.('dingtalk', enabled)
            : undefined
        }
      >
        <DingtalkConfigForm
          webhookUrl={dingtalkWebhookUrl}
          onChange={onDingtalkWebhookChange}
          configured={notificationStatus?.dingtalk?.configured}
        />
      </NotificationChannelCard>

      <NotificationChannelCard
        channelType="email"
        status={notificationStatus?.email}
        isExpanded={expandedChannel === 'email'}
        onToggle={() => handleToggle('email')}
      >
        {/* Email 配置表单（预留） */}
      </NotificationChannelCard>

      <NotificationChannelCard
        channelType="slack"
        status={notificationStatus?.slack}
        isExpanded={expandedChannel === 'slack'}
        onToggle={() => handleToggle('slack')}
      >
        {/* Slack 配置表单（预留） */}
      </NotificationChannelCard>

      <NotificationChannelCard
        channelType="wechat_work"
        status={notificationStatus?.wechat_work}
        isExpanded={expandedChannel === 'wechat_work'}
        onToggle={() => handleToggle('wechat_work')}
        onEnabledChange={
          notificationStatus?.wechat_work?.configured
            ? (enabled) => onChannelEnabledChange?.('wechat_work', enabled)
            : undefined
        }
      >
        <WechatWorkConfigForm
          apiUrl={wechatWorkApiUrl}
          onChange={onWechatWorkApiUrlChange}
          configured={notificationStatus?.wechat_work?.configured}
        />
      </NotificationChannelCard>
    </div>
  );
}
