import { describe, it, expect } from 'vitest';
import { mergeSkillCommands } from '../../../src/skills/skill-command-merger.js';
import type { ConfigurableCommand } from '#shared';

describe('mergeSkillCommands', () => {
  const createCommand = (
    label: string,
    overrides: Partial<ConfigurableCommand> = {},
  ): ConfigurableCommand => ({
    label,
    command: label,
    enabled: true,
    ...overrides,
  });

  /** 创建带 fromSkill 标记的 Skill 命令 */
  const createSkillCommand = (
    label: string,
    overrides: Partial<ConfigurableCommand> = {},
  ): ConfigurableCommand => createCommand(label, { fromSkill: true, ...overrides });

  it('should return empty array for empty inputs', () => {
    const result = mergeSkillCommands([], []);

    expect(result.commands).toEqual([]);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.preserved).toBe(0);
    expect(result.total).toBe(0);
  });

  it('should add new skill commands', () => {
    const newSkillCommands = [
      createSkillCommand('/skill-one'),
      createSkillCommand('/skill-two'),
    ];

    const result = mergeSkillCommands([], newSkillCommands);

    expect(result.commands).toHaveLength(2);
    expect(result.added).toBe(2);
    expect(result.removed).toBe(0);
    expect(result.preserved).toBe(0);
  });

  it('should preserve non-skill commands (system + user-defined)', () => {
    const existingCommands = [
      createCommand('/clear', { enabled: true }), // system command (no fromSkill)
      createCommand('Esc', { data: '\x1b' } as any), // shortcut-style
      createCommand('/deploy'), // user-defined slash command (no fromSkill)
    ];
    const newSkillCommands = [createSkillCommand('/new-skill')];

    const result = mergeSkillCommands(existingCommands, newSkillCommands);

    expect(result.commands).toHaveLength(4);
    expect(result.commands.find((c) => c.label === '/clear')).toBeDefined();
    expect(result.commands.find((c) => c.label === 'Esc')).toBeDefined();
    expect(result.commands.find((c) => c.label === '/deploy')).toBeDefined();
    expect(result.commands.find((c) => c.label === '/new-skill')).toBeDefined();
  });

  it('should not remove user-defined slash commands', () => {
    // User manually added /deploy — no fromSkill marker
    const existingCommands = [
      createCommand('/deploy'),
    ];
    // No skill produces /deploy
    const newSkillCommands = [createSkillCommand('/some-skill')];

    const result = mergeSkillCommands(existingCommands, newSkillCommands);

    // /deploy should be preserved as non-skill command
    expect(result.commands.find((c) => c.label === '/deploy')).toBeDefined();
    expect(result.removed).toBe(0);
  });

  it('should remove deleted skill commands', () => {
    const existingCommands = [
      createSkillCommand('/old-skill'),
      createSkillCommand('/kept-skill'),
    ];
    const newSkillCommands = [createSkillCommand('/kept-skill')];

    const result = mergeSkillCommands(existingCommands, newSkillCommands);

    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].label).toBe('/kept-skill');
    expect(result.removed).toBe(1);
    expect(result.preserved).toBe(1);
  });

  it('should preserve user modifications to existing skills (enabled, autoSend)', () => {
    const existingCommands = [
      createSkillCommand('/existing-skill', { enabled: false, autoSend: false, desc: 'User custom desc' }),
    ];
    const newSkillCommands = [
      createSkillCommand('/existing-skill', { desc: 'New default desc' }),
    ];

    const result = mergeSkillCommands(existingCommands, newSkillCommands);

    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].enabled).toBe(false); // preserved
    expect(result.commands[0].autoSend).toBe(false); // preserved
    // desc always updates from skill source
    expect(result.commands[0].desc).toBe('New default desc');
    expect(result.preserved).toBe(1);
  });

  it('should always update desc from skill source', () => {
    const existingCommands = [
      createSkillCommand('/existing-skill', { desc: 'Old desc from previous scan' }),
    ];
    const newSkillCommands = [
      createSkillCommand('/existing-skill', { desc: 'Updated desc' }),
    ];

    const result = mergeSkillCommands(existingCommands, newSkillCommands);

    expect(result.commands[0].desc).toBe('Updated desc');
  });

  it('should sort skill commands by label', () => {
    const newSkillCommands = [
      createSkillCommand('/zebra'),
      createSkillCommand('/alpha'),
      createSkillCommand('/beta'),
    ];

    const result = mergeSkillCommands([], newSkillCommands);

    const skillLabels = result.commands.map((c) => c.label);
    expect(skillLabels).toEqual(['/alpha', '/beta', '/zebra']);
  });

  it('should handle complex merge scenario', () => {
    const existingCommands = [
      createCommand('/clear'), // system (no fromSkill)
      createCommand('/compact'), // system (no fromSkill)
      createSkillCommand('/old-removed-skill'), // to be removed
      createSkillCommand('/existing-skill', { enabled: false }), // preserved
      createSkillCommand('/another-skill', { autoSend: false }), // preserved
    ];

    const newSkillCommands = [
      createSkillCommand('/existing-skill', { desc: 'Updated desc' }),
      createSkillCommand('/another-skill'),
      createSkillCommand('/new-skill'),
    ];

    const result = mergeSkillCommands(existingCommands, newSkillCommands);

    // 2 system + 3 skill = 5 total
    expect(result.commands).toHaveLength(5);

    expect(result.added).toBe(1); // new-skill
    expect(result.removed).toBe(1); // old-removed-skill
    expect(result.preserved).toBe(2); // existing-skill + another-skill
    expect(result.total).toBe(3);

    const existingSkill = result.commands.find((c) => c.label === '/existing-skill');
    expect(existingSkill?.enabled).toBe(false);

    const anotherSkill = result.commands.find((c) => c.label === '/another-skill');
    expect(anotherSkill?.autoSend).toBe(false);
  });

  it('should not treat system commands as skill commands', () => {
    const existingCommands = [
      createCommand('/clear', { enabled: false }), // no fromSkill
      createSkillCommand('/custom-skill', { enabled: false }),
    ];
    const newSkillCommands = [
      createSkillCommand('/custom-skill'),
    ];

    const result = mergeSkillCommands(existingCommands, newSkillCommands);

    const clearCmd = result.commands.find((c) => c.label === '/clear');
    expect(clearCmd?.enabled).toBe(false);

    const customCmd = result.commands.find((c) => c.label === '/custom-skill');
    expect(customCmd?.enabled).toBe(false);
  });
});
