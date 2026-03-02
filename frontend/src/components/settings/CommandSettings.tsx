import { useState } from 'react';
import type { ConfigurableCommand } from '../../config/commands.js';
import type { WithId } from './SettingsModal.js';

interface CommandSettingsProps {
  commands: WithId<ConfigurableCommand>[];
  onChange: (commands: WithId<ConfigurableCommand>[]) => void;
}

export function CommandSettings({ commands, onChange }: CommandSettingsProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (index: number) => {
    setEditingIndex(index);
    // 编辑时显示实际命令（去掉 / 前缀以便编辑）
    setEditValue(commands[index].command);
  };

  const saveEdit = (index: number) => {
    let value = editValue.trim();
    if (!value) {
      // 空值直接删除
      deleteCommand(index);
      return;
    }

    // 自动补足 / 前缀
    if (!value.startsWith('/')) {
      value = '/' + value;
    }

    const newCommands = [...commands];
    // label 默认为命令本身
    newCommands[index] = {
      ...newCommands[index],
      label: value,
      command: value,
    };
    onChange(newCommands);
    setEditingIndex(null);
  };

  const toggleEnabled = (index: number) => {
    const newCommands = [...commands];
    newCommands[index] = {
      ...newCommands[index],
      enabled: !newCommands[index].enabled,
    };
    onChange(newCommands);
  };

  const addCommand = () => {
    const newCommands: WithId<ConfigurableCommand>[] = [...commands, { label: '/new', command: '/new', enabled: true, _id: crypto.randomUUID() }];
    onChange(newCommands);
    // 自动开始编辑新添加的项
    setEditingIndex(newCommands.length - 1);
    setEditValue('/new');
  };

  const deleteCommand = (index: number) => {
    const newCommands = commands.filter((_, i) => i !== index);
    onChange(newCommands);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          命令
        </span>
        <button
          onClick={addCommand}
          style={{
            padding: '4px 12px',
            fontSize: 13,
            borderRadius: 4,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          + 添加
        </button>
      </div>

      {commands.length === 0 && (
        <div style={{
          padding: 16,
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}>
          暂无命令，点击上方按钮添加
        </div>
      )}

      {commands.map((cmd, index) => (
        <div
          key={cmd._id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 6,
            background: 'var(--bg-tertiary)',
          }}
        >
          {/* 启用开关 */}
          <button
            onClick={() => toggleEnabled(index)}
            style={{
              width: 32,
              height: 20,
              borderRadius: 10,
              border: 'none',
              background: cmd.enabled ? 'var(--status-running)' : 'var(--bg-primary)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            <span style={{
              position: 'absolute',
              top: 2,
              left: cmd.enabled ? 14 : 2,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
            }} />
          </button>

          {/* 命令输入/显示 */}
          {editingIndex === index ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit(index);
                if (e.key === 'Escape') setEditingIndex(null);
              }}
              onBlur={() => saveEdit(index)}
              placeholder="输入命令..."
              autoFocus
              style={{
                flex: 1,
                height: 32,
                padding: '0 8px',
                borderRadius: 4,
                border: '2px solid var(--status-running)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          ) : (
            <div
              onClick={() => startEdit(index)}
              style={{
                flex: 1,
                height: 32,
                padding: '0 8px',
                borderRadius: 4,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              {cmd.label}
            </div>
          )}

          {/* 删除按钮 */}
          <button
            onClick={() => deleteCommand(index)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>
      ))}

      <div style={{
        fontSize: 12,
        color: 'var(--text-muted)',
        marginTop: 8,
      }}>
        提示：命令会自动补足 / 前缀（如 help → /help）
      </div>
    </div>
  );
}