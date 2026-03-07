import type { ConfigurableCommand } from '#shared';
import { isSkillCommand } from './skill-commands.js';

/**
 * 合并结果统计
 */
export interface MergeResult {
  /** 最终合并后的命令列表 */
  commands: ConfigurableCommand[];
  /** 新增的 Skill 数量 */
  added: number;
  /** 移除的 Skill 数量 */
  removed: number;
  /** 保留并合并用户修改的 Skill 数量 */
  preserved: number;
  /** 总 Skill Command 数量 */
  total: number;
}

/**
 * 智能合并 Skill Commands
 *
 * 合并策略：
 * 1. 保留所有非 Skill commands（系统默认 + 用户自定义）
 * 2. 对于 Skill commands：
 *    - 新增 Skill → 添加到列表
 *    - 删除 Skill → 从列表移除
 *    - 保留的 Skill → 保留用户的 enabled、autoSend、desc 修改
 *
 * @param existingCommands 现有命令列表（可能包含用户的修改）
 * @param newSkillCommands 新扫描出的 Skill Commands
 * @returns 合并结果
 */
export function mergeSkillCommands(
  existingCommands: ConfigurableCommand[],
  newSkillCommands: ConfigurableCommand[],
): MergeResult {
  // 1. 分离现有命令：非 Skill commands 和 Skill commands
  const nonSkillCommands: ConfigurableCommand[] = [];
  const existingSkillCommands = new Map<string, ConfigurableCommand>();

  for (const cmd of existingCommands) {
    if (isSkillCommand(cmd)) {
      existingSkillCommands.set(cmd.label, cmd);
    } else {
      nonSkillCommands.push(cmd);
    }
  }

  // 2. 构建新 Skill 命令映射
  const newSkillMap = new Map<string, ConfigurableCommand>();
  for (const cmd of newSkillCommands) {
    newSkillMap.set(cmd.label, cmd);
  }

  // 3. 合并 Skill commands
  const mergedSkillCommands: ConfigurableCommand[] = [];
  let added = 0;
  let removed = 0;
  let preserved = 0;

  // 处理新 Skill
  for (const [label, newCmd] of newSkillMap) {
    const existingCmd = existingSkillCommands.get(label);

    if (existingCmd) {
      // Skill 存在，保留用户的交互设置，desc 始终从 Skill 源更新
      mergedSkillCommands.push({
        ...newCmd,
        // 保留用户的 enabled 设置
        enabled: existingCmd.enabled,
        // 保留用户的 autoSend 设置
        autoSend: existingCmd.autoSend ?? newCmd.autoSend,
      });
      preserved++;
    } else {
      // 新 Skill，直接添加
      mergedSkillCommands.push(newCmd);
      added++;
    }
  }

  // 统计移除的 Skill
  for (const [label] of existingSkillCommands) {
    if (!newSkillMap.has(label)) {
      removed++;
    }
  }

  // 4. 组合最终结果：非 Skill commands + 合并后的 Skill commands
  // 按 label 排序 Skill commands
  mergedSkillCommands.sort((a, b) => a.label.localeCompare(b.label));

  const finalCommands = [...nonSkillCommands, ...mergedSkillCommands];

  return {
    commands: finalCommands,
    added,
    removed,
    preserved,
    total: mergedSkillCommands.length,
  };
}