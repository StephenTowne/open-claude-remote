import { useState } from 'react';
import { WECHAT_WORK_SENDKEY_PATTERN } from '#shared';

interface WechatWorkConfigFormProps {
  sendkey: string;
  onChange: (sendkey: string) => void;
  configured?: boolean;
}

export function WechatWorkConfigForm({
  sendkey,
  onChange,
  configured,
}: WechatWorkConfigFormProps) {
  const [showValidation, setShowValidation] = useState(false);

  const isValid = sendkey === '' || WECHAT_WORK_SENDKEY_PATTERN.test(sendkey);
  const showError = showValidation && !isValid && sendkey !== '';

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
          Sendkey
        </label>
        <input
          type="text"
          autoComplete="off"
          placeholder="SCTxxx or sctpxxx"
          value={sendkey}
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
            Please enter a valid Sendkey starting with SCT or sctp
          </div>
        )}
      </div>

      {configured && !sendkey && (
        <div
          style={{
            padding: 10,
            background: 'rgba(46, 204, 113, 0.1)',
            borderRadius: 6,
            fontSize: 13,
            color: 'var(--status-running)',
          }}
        >
          ✓ Configured. Enter a new Sendkey to update.
        </div>
      )}

      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}
      >
        <a
          href="https://sct.ftqq.com/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--status-running)' }}
        >
          How to get Server酱 Sendkey?
        </a>
      </div>
    </div>
  );
}