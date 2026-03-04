import { useState } from 'react';
import { DINGTALK_WEBHOOK_PATTERN } from '#shared';

interface DingtalkConfigFormProps {
  webhookUrl: string;
  onChange: (url: string) => void;
  configured?: boolean;
}

export function DingtalkConfigForm({
  webhookUrl,
  onChange,
  configured,
}: DingtalkConfigFormProps) {
  const [showValidation, setShowValidation] = useState(false);

  const isValid = webhookUrl === '' || DINGTALK_WEBHOOK_PATTERN.test(webhookUrl);
  const showError = showValidation && !isValid && webhookUrl !== '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label
          style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 500,
            marginBottom: 8,
            color: 'var(--text-primary)',
          }}
        >
          Webhook URL
        </label>
        <input
          type="url"
          placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
          value={webhookUrl}
          onChange={(e) => {
            onChange(e.target.value);
            // 输入时不清除验证状态，保持用户看到的反馈
          }}
          onBlur={() => setShowValidation(true)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 6,
            border: `1px solid ${showError ? 'var(--status-error)' : 'var(--border-color)'}`,
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: 14,
            boxSizing: 'border-box',
          }}
        />
        {showError && (
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: 'var(--status-error)',
            }}
          >
            Please enter a valid DingTalk Webhook URL starting with https://oapi.dingtalk.com/robot/send?access_token=
          </div>
        )}
      </div>

      {configured && !webhookUrl && (
        <div
          style={{
            padding: 10,
            background: 'rgba(46, 204, 113, 0.1)',
            borderRadius: 6,
            fontSize: 13,
            color: 'var(--status-running)',
          }}
        >
          ✓ Configured. Enter a new URL to update.
        </div>
      )}

      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}
      >
        <a
          href="https://open.dingtalk.com/document/robots/custom-robot-access"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--status-running)' }}
        >
          How to get DingTalk group bot Webhook?
        </a>
      </div>
    </div>
  );
}
