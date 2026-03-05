import { NOTIFICATION_CHANNELS } from '#shared';
import type { NotificationChannelType, SafeNotificationChannelStatus } from '#shared';
import { Toggle } from '../common/Toggle.js';

interface NotificationChannelCardProps {
  channelType: NotificationChannelType;
  status?: SafeNotificationChannelStatus;
  isExpanded: boolean;
  onToggle: () => void;
  /** 启用状态变更回调（仅已配置渠道有效） */
  onEnabledChange?: (enabled: boolean) => void;
  children?: React.ReactNode;
}

export function NotificationChannelCard({
  channelType,
  status,
  isExpanded,
  onToggle,
  onEnabledChange,
  children,
}: NotificationChannelCardProps) {
  const meta = NOTIFICATION_CHANNELS[channelType];
  const isImplemented = meta?.implemented ?? false;
  const isConfigured = status?.configured ?? false;
  const isEnabled = status?.enabled ?? true; // undefined 表示默认启用

  // 图标映射
  const iconMap: Record<string, string> = {
    dingtalk: '📱',
    email: '📧',
    slack: '💬',
    wechat_work: '💼',
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发展开/收起
  };

  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        background: 'var(--bg-tertiary)',
        overflow: 'hidden',
        opacity: isImplemented ? 1 : 0.6,
      }}
    >
      {/* 头部（可点击展开/收起） */}
      <button
        onClick={isImplemented ? onToggle : undefined}
        style={{
          width: '100%',
          padding: '16px',
          border: 'none',
          background: isExpanded ? 'var(--bg-secondary)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: isImplemented ? 'pointer' : 'default',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>{iconMap[channelType] ?? '🔔'}</span>
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {meta?.displayName ?? channelType}
              {isConfigured && (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: isEnabled ? 'var(--status-running)' : 'var(--text-muted)',
                  }}
                  title={isEnabled ? 'Enabled' : 'Disabled'}
                />
              )}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                marginTop: 2,
              }}
            >
              {meta?.description ?? ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 已配置渠道显示 Toggle 开关 */}
          {isConfigured && onEnabledChange && (
            <div onClick={handleToggleClick}>
              <Toggle
                checked={isEnabled}
                onChange={onEnabledChange}
                aria-label={`Toggle ${meta?.displayName ?? channelType}`}
              />
            </div>
          )}
          {!isImplemented && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                background: 'var(--bg-secondary)',
                padding: '4px 10px',
                borderRadius: 12,
              }}
            >
              Coming
            </span>
          )}
          {isImplemented && (
            <svg
              style={{
                width: 16,
                height: 16,
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
                color: 'var(--text-secondary)',
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </div>
      </button>

      {/* 展开内容 */}
      {isImplemented && isExpanded && (
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
