import { useState, useEffect, useCallback } from 'react';
import {
  type UserConfig,
  type ShortcutKey,
  type CommandItem,
  DEFAULT_SHORTCUTS,
  DEFAULT_COMMANDS,
  filterEnabled,
} from '../config/commands.js';
import { getUserConfig } from '../services/api-client.js';

interface UseUserConfigResult {
  shortcuts: ShortcutKey[];
  commands: CommandItem[];
  configPath: string | null;
  isLoading: boolean;
  reload: () => void;
}

/**
 * 加载用户配置的 hook
 * 如果配置文件不存在，使用默认值
 */
export function useUserConfig(): UseUserConfigResult {
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [configPath, setConfigPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getUserConfig();
      setConfig(result.config);
      setConfigPath(result.configPath);
    } catch {
      // 认证失败或其他错误，使用默认配置
      setConfig(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 从配置中提取启用的快捷键和命令，如果没有配置则使用默认值
  const shortcuts = config
    ? filterEnabled(config.shortcuts)
    : DEFAULT_SHORTCUTS;

  const commands = config
    ? filterEnabled(config.commands)
    : DEFAULT_COMMANDS;

  return {
    shortcuts,
    commands,
    configPath,
    isLoading,
    reload: loadConfig,
  };
}