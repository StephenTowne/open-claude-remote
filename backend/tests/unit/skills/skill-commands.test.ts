import { describe, it, expect } from 'vitest';
import {
  skillToCommand,
  convertSkillsToCommands,
  isSkillCommand,
} from '../../../src/skills/skill-commands.js';
import type { SkillInfo } from '../../../src/skills/skill-scanner.js';
import type { ConfigurableCommand } from '#shared';

describe('skillToCommand', () => {
  it('should convert skill to command with all fields', () => {
    const skill: SkillInfo = {
      name: 'finish-task',
      description: 'Task completion gate',
      path: '/path/to/SKILL.md',
      source: 'project',
    };

    const result = skillToCommand(skill);

    expect(result.label).toBe('/finish-task');
    expect(result.command).toBe('/finish-task');
    expect(result.enabled).toBe(true);
    expect(result.autoSend).toBe(true);
    expect(result.desc).toBe('Task completion gate');
    expect(result.fromSkill).toBe(true);
  });

  it('should truncate description to 50 characters', () => {
    const skill: SkillInfo = {
      name: 'test',
      description: 'A very long description that exceeds fifty characters limit',
      path: '/path/to/SKILL.md',
      source: 'global',
    };

    const result = skillToCommand(skill);

    expect(result.desc).toBe('A very long description that exceeds fifty charact');
    expect(result.desc?.length).toBe(50);
  });

  it('should handle skill without description', () => {
    const skill: SkillInfo = {
      name: 'no-desc',
      path: '/path/to/SKILL.md',
      source: 'project',
    };

    const result = skillToCommand(skill);

    expect(result.desc).toBeUndefined();
  });
});

describe('convertSkillsToCommands', () => {
  it('should convert empty array to empty array', () => {
    const result = convertSkillsToCommands([]);
    expect(result).toEqual([]);
  });

  it('should convert multiple skills', () => {
    const skills: SkillInfo[] = [
      { name: 'skill-one', path: '/a', source: 'global' },
      { name: 'skill-two', path: '/b', source: 'project', description: 'Desc' },
    ];

    const result = convertSkillsToCommands(skills);

    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('/skill-one');
    expect(result[1].label).toBe('/skill-two');
    expect(result[1].desc).toBe('Desc');
  });
});

describe('isSkillCommand', () => {
  it('should return true for command with fromSkill marker', () => {
    const cmd: ConfigurableCommand = {
      label: '/finish-task',
      command: '/finish-task',
      enabled: true,
      fromSkill: true,
    };

    expect(isSkillCommand(cmd)).toBe(true);
  });

  it('should return false for system command (no fromSkill marker)', () => {
    const systemCommands = ['/clear', '/compact', '/resume', '/stats', '/exit', '/rename'];

    for (const label of systemCommands) {
      const cmd: ConfigurableCommand = {
        label,
        command: label,
        enabled: true,
      };
      expect(isSkillCommand(cmd)).toBe(false);
    }
  });

  it('should return false for non-slash command', () => {
    const cmd: ConfigurableCommand = {
      label: 'Esc',
      command: 'Esc',
      enabled: true,
    };

    expect(isSkillCommand(cmd)).toBe(false);
  });

  it('should return false for user-defined slash command without fromSkill', () => {
    const cmd: ConfigurableCommand = {
      label: '/deploy',
      command: '/deploy',
      enabled: true,
    };

    expect(isSkillCommand(cmd)).toBe(false);
  });
});