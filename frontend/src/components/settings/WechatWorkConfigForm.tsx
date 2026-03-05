import { useState } from 'react';
import { WECHAT_WORK_API_URL_PATTERN } from '#shared';

interface WechatWorkConfigFormProps {
  apiUrl: string;
  onChange: (apiUrl: string) => void;
  configured?: boolean;
}

export function WechatWorkConfigForm({
  apiUrl,
  onChange,
  configured,
}: WechatWorkConfigFormProps) {
  const [showValidation, setShowValidation] = useState(false);

  const isValid = apiUrl === '' || WECHAT_WORK_API_URL_PATTERN.test(apiUrl);
  const showError = showValidation && !isValid && apiUrl !== '';

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
          API URL
        </label>
        <input
          type="url"
          autoComplete="off"
          placeholder="https://<uid>.push.ft07.com/send/<sendkey>.send"
          value={apiUrl}
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
            Please enter a valid Server酱³ API URL
          </div>
        )}
      </div>

      {configured && !apiUrl && (
        <div
          style={{
            padding: 10,
            background: 'rgba(46, 204, 113, 0.1)',
            borderRadius: 6,
            fontSize: 13,
            color: 'var(--status-running)',
          }}
        >
          ✓ Configured. Enter a new API URL to update.
        </div>
      )}

      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}
      >
        <a
          href="https://sct.ftqq.com/sendkey"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--status-running)' }}
        >
          How to get Server酱³ API URL?
        </a>
      </div>
    </div>
  );
}