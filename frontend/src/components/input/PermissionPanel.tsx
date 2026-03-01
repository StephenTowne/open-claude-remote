import type { PermissionSuggestion } from '@claude-remote/shared';

export interface PermissionPanelProps {
  toolName: string;
  toolInput: Record<string, unknown>;
  permissionSuggestions?: PermissionSuggestion[];
  onAllow: (alwaysAllow?: boolean) => void;
  onDeny: () => void;
}

/** 优先展示 command / file_path / path，回退到首个 string 值 */
function formatToolInput(input: Record<string, unknown>): string {
  // 优先展示最具描述性的字段
  for (const key of ['command', 'file_path', 'path'] as const) {
    if (typeof input[key] === 'string') {
      return (input[key] as string).slice(0, 200);
    }
  }

  // 回退：收集所有 string 值
  const parts: string[] = [];
  for (const value of Object.values(input)) {
    if (typeof value === 'string') {
      parts.push(value);
    } else if (typeof value === 'object' && value !== null) {
      parts.push(JSON.stringify(value));
    }
  }

  return parts.join(' ').slice(0, 200);
}

export function PermissionPanel({
  toolName,
  toolInput,
  permissionSuggestions,
  onAllow,
  onDeny,
}: PermissionPanelProps) {
  const inputPreview = formatToolInput(toolInput);
  const hasSuggestions = permissionSuggestions && permissionSuggestions.length > 0;

  return (
    <div
      data-testid="permission-panel"
      role="dialog"
      aria-labelledby="permission-title"
      style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 12px',
      }}
    >
      {/* Title */}
      <div
        id="permission-title"
        style={{
          fontSize: 13,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
        }}
      >
        Claude 请求使用 <span style={{ color: '#58a6ff' }}>{toolName}</span>
      </div>

      {/* Input preview */}
      {inputPreview && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            background: 'var(--bg-tertiary)',
            padding: '6px 10px',
            borderRadius: 4,
            maxHeight: 60,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {inputPreview}
        </div>
      )}

      {/* Buttons */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginTop: 4,
      }}>
        <button
          className="focus-ring perm-btn"
          onClick={() => onAllow(false)}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: 6,
            border: 'none',
            background: '#238636',
            color: '#fff',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          允许
        </button>
        {hasSuggestions && (
          <button
            className="focus-ring perm-btn"
            onClick={() => onAllow(true)}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 6,
              border: '1px solid #238636',
              background: 'transparent',
              color: '#238636',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            始终允许
          </button>
        )}
        <button
          className="focus-ring perm-btn"
          onClick={onDeny}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: 6,
            border: '1px solid var(--border-color)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          拒绝
        </button>
      </div>
    </div>
  );
}
