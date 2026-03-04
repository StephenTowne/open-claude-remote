import { NOTIFICATION_CHANNELS } from '#shared';
import type { NotificationChannelType, SafeNotificationChannelStatus } from '#shared';

interface NotificationChannelCardProps {
  channelType: NotificationChannelType;
  status?: SafeNotificationChannelStatus;
  isExpanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

export function NotificationChannelCard({
  channelType,
  status,
  isExpanded,
  onToggle,
  children,
}: NotificationChannelCardProps) {
  const meta = NOTIFICATION_CHANNELS[channelType];
  const isImplemented = meta?.implemented ?? false;
  const isConfigured = status?.configured ?? false;

  // 图标映射
  const iconMap: Record<string, string> = {
    dingtalk: '📱',
    email: '📧',
    slack: '💬',
    wechat_work: '💼',
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
                    background: 'var(--status-running)',
                  }}
                  title="Configured"
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
