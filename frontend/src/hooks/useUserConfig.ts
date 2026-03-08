import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import {
  type SafeUserConfig,
  type ShortcutKey,
  type CommandItem,
  DEFAULT_SHORTCUTS,
  DEFAULT_COMMANDS,
  filterEnabled,
} from '../config/commands.js';
import { getUserConfig } from '../services/api-client.js';
import { useInstanceStore } from '../stores/instance-store.js';

interface UseUserConfigResult {
  shortcuts: ShortcutKey[];
  commands: CommandItem[];
  configPath: string | null;
  isLoading: boolean;
  reload: () => void;
}

// 模块级版本号，所有 useUserConfig 实例共享
// 当任意实例调用 reload 时递增，触发所有实例重新加载
let configVersion = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return configVersion;
}

/** 通知所有 useUserConfig 实例重新加载配置 */
export function notifyConfigChanged() {
  configVersion++;
  listeners.forEach((l) => l());
}

/**
 * 加载用户配置的 hook
 * 如果配置文件不存在，使用默认值
 * 所有实例共享全局版本号，任意实例 reload 会触发全部重新加载
 * 支持实例隔离：根据 activeInstanceId 加载对应实例的合并配置
 */
export function useUserConfig(): UseUserConfigResult {
  const [config, setConfig] = useState<SafeUserConfig | null>(null);
  const [configPath, setConfigPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const version = useSyncExternalStore(subscribe, getSnapshot);
  const activeInstanceId = useInstanceStore((state) => state.activeInstanceId);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getUserConfig(activeInstanceId ?? undefined);
      setConfig(result.config);
      setConfigPath(result.configPath);
    } catch {
      // 认证失败或其他错误，使用默认配置
      setConfig(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeInstanceId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig, version]);

  // 从配置中提取启用的快捷键和命令
  // 注意：后端已经实现懒填充（返回时填充默认值但不持久化）
  // 这里的 fallback 是向后端行为不一致时的边界保护
  const shortcuts = config?.shortcuts
    ? filterEnabled(config.shortcuts)
    : DEFAULT_SHORTCUTS;

  const commands = config?.commands
    ? filterEnabled(config.commands)
    : DEFAULT_COMMANDS;

  const reload = useCallback(() => {
    notifyConfigChanged();
  }, []);

  return {
    shortcuts,
    commands,
    configPath,
    isLoading,
    reload,
  };
}