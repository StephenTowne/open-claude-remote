import type { ConfigurableCommand } from '#shared';
import type { SkillInfo } from './skill-scanner.js';


/**
 * 将 Skill 信息转换为 ConfigurableCommand
 * @param skill Skill 信息
 * @returns ConfigurableCommand 对象
 */
export function skillToCommand(skill: SkillInfo): ConfigurableCommand {
  return {
    label: `/${skill.name}`,
    command: `/${skill.name}`,
    enabled: true,
    // 描述截断到 50 字符
    desc: skill.description?.slice(0, 50),
    // 默认直接发送
    autoSend: true,
    // 标记为 Skill 来源，用于合并时区分用户自定义命令
    fromSkill: true,
  };
}

/**
 * 批量将 Skills 转换为 Commands
 * @param skills Skill 信息数组
 * @returns ConfigurableCommand 数组
 */
export function convertSkillsToCommands(skills: SkillInfo[]): ConfigurableCommand[] {
  return skills.map(skillToCommand);
}

/**
 * 判断一个 Command 是否为 Skill Command
 * 基于 fromSkill 标记判断，避免误将用户自定义斜杠命令识别为 Skill Command
 */
export function isSkillCommand(command: ConfigurableCommand): boolean {
  return command.fromSkill === true;
}