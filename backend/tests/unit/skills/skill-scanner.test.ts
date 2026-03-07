import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseSkillFrontmatter,
  scanSkillDirectory,
  scanSkills,
  clearScanCache,
} from '../../../src/skills/skill-scanner.js';

// Mock homedir — scanSkills 测试中会覆盖返回值
// 默认值使用真实 homedir，避免影响 logger 等模块初始化
const { mockHomedir } = vi.hoisted(() => {
  const os = require('node:os');
  return { mockHomedir: vi.fn().mockReturnValue(os.homedir()) };
});
vi.mock('node:os', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:os')>();
  return { ...original, homedir: () => mockHomedir() };
});

describe('parseSkillFrontmatter', () => {
  it('should parse name from single-line frontmatter', () => {
    const content = `---
name: finish-task
---
# Content`;

    const result = parseSkillFrontmatter(content);
    expect(result.name).toBe('finish-task');
  });

  it('should parse description from single-line frontmatter', () => {
    const content = `---
name: test-skill
description: A test skill
---
# Content`;

    const result = parseSkillFrontmatter(content);
    expect(result.name).toBe('test-skill');
    expect(result.description).toBe('A test skill');
  });

  it('should parse multi-line description with > indicator', () => {
    const content = `---
name: auto-doc
description: >
  Maintains project navigation docs.
  Use when user says "update docs".
---
# Content`;

    const result = parseSkillFrontmatter(content);
    expect(result.name).toBe('auto-doc');
    expect(result.description).toBe('Maintains project navigation docs. Use when user says "update docs".');
  });

  it('should return empty object when no frontmatter', () => {
    const content = `# No frontmatter here`;

    const result = parseSkillFrontmatter(content);
    expect(result.name).toBeUndefined();
    expect(result.description).toBeUndefined();
  });

  it('should return empty object when frontmatter missing name', () => {
    const content = `---
description: Missing name
---
# Content`;

    const result = parseSkillFrontmatter(content);
    expect(result.name).toBeUndefined();
    expect(result.description).toBe('Missing name');
  });
});

describe('scanSkillDirectory', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = resolve(tmpdir(), `skill-scanner-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should return empty array when directory does not exist', () => {
    const result = scanSkillDirectory('/nonexistent/path', 'global');
    expect(result).toEqual([]);
  });

  it('should return empty array when directory has no skill directories', () => {
    const result = scanSkillDirectory(tempDir, 'project');
    expect(result).toEqual([]);
  });

  it('should skip directories without SKILL.md', () => {
    mkdirSync(join(tempDir, 'no-skill-file'));

    const result = scanSkillDirectory(tempDir, 'project');
    expect(result).toEqual([]);
  });

  it('should skip SKILL.md missing name field', () => {
    const skillDir = join(tempDir, 'invalid-skill');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), `---
description: No name
---
# Content`);

    const result = scanSkillDirectory(tempDir, 'project');
    expect(result).toEqual([]);
  });

  it('should parse valid skill directory', () => {
    const skillDir = join(tempDir, 'test-skill');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), `---
name: test-skill
description: Test description
---
# Content`);

    const result = scanSkillDirectory(tempDir, 'global');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('test-skill');
    expect(result[0].description).toBe('Test description');
    expect(result[0].source).toBe('global');
    expect(result[0].path).toBe(join(skillDir, 'SKILL.md'));
  });

  it('should parse multiple skill directories', () => {
    // Skill 1
    const skillDir1 = join(tempDir, 'skill-one');
    mkdirSync(skillDir1);
    writeFileSync(join(skillDir1, 'SKILL.md'), `---
name: skill-one
---
# Content`);

    // Skill 2
    const skillDir2 = join(tempDir, 'skill-two');
    mkdirSync(skillDir2);
    writeFileSync(join(skillDir2, 'SKILL.md'), `---
name: skill-two
---
# Content`);

    const result = scanSkillDirectory(tempDir, 'project');

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.name).sort()).toEqual(['skill-one', 'skill-two']);
  });
});

describe('scanSkills', () => {
  let tempHome: string;
  let tempProjectDir: string;

  beforeEach(() => {
    tempHome = resolve(tmpdir(), `skill-home-${Date.now()}`);
    tempProjectDir = resolve(tmpdir(), `skill-project-${Date.now()}`);
    mkdirSync(tempHome, { recursive: true });
    mkdirSync(tempProjectDir, { recursive: true });

    mockHomedir.mockReturnValue(tempHome);
    clearScanCache();
  });

  afterEach(() => {
    rmSync(tempHome, { recursive: true, force: true });
    rmSync(tempProjectDir, { recursive: true, force: true });
  });

  it('should return empty array when no skill directories exist', () => {
    const result = scanSkills(tempProjectDir);
    expect(result).toEqual([]);
  });

  it('should scan global skills from ~/.claude/skills/', () => {
    const globalSkillDir = join(tempHome, '.claude', 'skills', 'global-skill');
    mkdirSync(globalSkillDir, { recursive: true });
    writeFileSync(join(globalSkillDir, 'SKILL.md'), `---
name: global-skill
description: Global level
---
# Content`);

    const result = scanSkills(tempProjectDir);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('global-skill');
    expect(result[0].source).toBe('global');
  });

  it('should scan project skills from <cwd>/.claude/skills/', () => {
    const projectSkillDir = join(tempProjectDir, '.claude', 'skills', 'project-skill');
    mkdirSync(projectSkillDir, { recursive: true });
    writeFileSync(join(projectSkillDir, 'SKILL.md'), `---
name: project-skill
description: Project level
---
# Content`);

    const result = scanSkills(tempProjectDir);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('project-skill');
    expect(result[0].source).toBe('project');
  });

  it('should merge global and project skills', () => {
    // Global skill
    const globalSkillDir = join(tempHome, '.claude', 'skills', 'global-skill');
    mkdirSync(globalSkillDir, { recursive: true });
    writeFileSync(join(globalSkillDir, 'SKILL.md'), `---
name: global-skill
---
# Content`);

    // Project skill
    const projectSkillDir = join(tempProjectDir, '.claude', 'skills', 'project-skill');
    mkdirSync(projectSkillDir, { recursive: true });
    writeFileSync(join(projectSkillDir, 'SKILL.md'), `---
name: project-skill
---
# Content`);

    const result = scanSkills(tempProjectDir);

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.name).sort()).toEqual(['global-skill', 'project-skill']);
  });

  it('should let project skill override global skill with same name', () => {
    // Global skill
    const globalSkillDir = join(tempHome, '.claude', 'skills', 'override-skill');
    mkdirSync(globalSkillDir, { recursive: true });
    writeFileSync(join(globalSkillDir, 'SKILL.md'), `---
name: override-skill
description: Global version
---
# Content`);

    // Project skill with same name
    const projectSkillDir = join(tempProjectDir, '.claude', 'skills', 'override-skill');
    mkdirSync(projectSkillDir, { recursive: true });
    writeFileSync(join(projectSkillDir, 'SKILL.md'), `---
name: override-skill
description: Project version
---
# Content`);

    const result = scanSkills(tempProjectDir);

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Project version');
    expect(result[0].source).toBe('project');
  });
});
