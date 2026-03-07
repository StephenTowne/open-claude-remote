import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '../logger/logger.js';

/**
 * Skill 信息结构
 */
export interface SkillInfo {
  /** Skill 名称（从 YAML frontmatter 提取） */
  name: string;
  /** Skill 描述（可选） */
  description?: string;
  /** SKILL.md 文件完整路径 */
  path: string;
  /** Skill 来源：全局或项目级 */
  source: 'global' | 'project';
}

/**
 * 解析 Skill 文件的 YAML frontmatter
 * @param content SKILL.md 文件内容
 * @returns 解析出的 name 和 description，解析失败返回空对象
 */
export function parseSkillFrontmatter(content: string): { name?: string; description?: string } {
  // 匹配 YAML frontmatter: ---\n...\n---
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    return {};
  }

  const frontmatter = frontmatterMatch[1];
  const result: { name?: string; description?: string } = {};

  // 解析 name 字段
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  if (nameMatch) {
    result.name = nameMatch[1].trim();
  }

  // 解析 description 字段（支持多行 YAML 字符串）
  const descMatch = frontmatter.match(/^description:\s*([>\|]?)\s*$/m);
  if (descMatch) {
    if (descMatch[1] === '>' || descMatch[1] === '|') {
      // 多行字符串：取后续缩进行，直到遇到非缩进行
      const lines = frontmatter.split('\n');
      let inDesc = false;
      const descLines: string[] = [];

      for (const line of lines) {
        if (inDesc) {
          if (line.startsWith('  ') || line.startsWith('\t')) {
            descLines.push(line.trim());
          } else if (line.trim() === '') {
            // 空行结束多行字符串
            break;
          } else {
            break;
          }
        } else if (line.startsWith('description:')) {
          inDesc = true;
        }
      }

      if (descLines.length > 0) {
        result.description = descLines.join(' ').trim();
      }
    }
  }

  // 尝试单行 description
  if (!result.description) {
    const singleLineMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (singleLineMatch) {
      result.description = singleLineMatch[1].trim();
    }
  }

  return result;
}

/**
 * 扫描单个 Skill 目录
 * @param dir Skill 目录路径
 * @param source Skill 来源
 * @returns Skill 信息数组
 */
export function scanSkillDirectory(dir: string, source: 'global' | 'project'): SkillInfo[] {
  const skills: SkillInfo[] = [];

  // 目录不存在则返回空数组
  if (!existsSync(dir)) {
    return skills;
  }

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      // 只处理目录
      if (!entry.isDirectory()) continue;

      const skillDir = join(dir, entry.name);
      const skillFilePath = join(skillDir, 'SKILL.md');

      // SKILL.md 不存在则跳过
      if (!existsSync(skillFilePath)) {
        continue;
      }

      try {
        const content = readFileSync(skillFilePath, 'utf-8');
        const frontmatter = parseSkillFrontmatter(content);

        // 缺少 name 字段则跳过
        if (!frontmatter.name) {
          logger.warn({ skillFilePath, source }, 'Skill missing name field in frontmatter, skipping');
          continue;
        }

        skills.push({
          name: frontmatter.name,
          description: frontmatter.description,
          path: skillFilePath,
          source,
        });
      } catch (err) {
        logger.warn({ skillFilePath, source, err }, 'Failed to parse SKILL.md, skipping');
      }
    }
  } catch (err) {
    logger.warn({ dir, source, err }, 'Failed to scan skill directory');
  }

  return skills;
}

/** 缓存 TTL（毫秒） */
const CACHE_TTL_MS = 5000;

/** 缓存项 */
interface ScanCache {
  skills: SkillInfo[];
  timestamp: number;
  key: string;
}

let scanCache: ScanCache | null = null;

/**
 * 扫描全局和项目级 Skill 目录（带 5 秒 TTL 缓存）
 * @param projectDir 项目工作目录
 * @returns 合并后的 Skill 信息数组（项目级优先覆盖全局同名 Skill）
 */
export function scanSkills(projectDir: string): SkillInfo[] {
  const home = homedir();

  // 全局 Skill 目录: ~/.claude/skills/
  const globalSkillDir = resolve(home, '.claude', 'skills');

  // 项目级 Skill 目录: <projectDir>/.claude/skills/
  const projectSkillDir = resolve(projectDir, '.claude', 'skills');

  // 检查缓存
  const cacheKey = `${globalSkillDir}|${projectSkillDir}`;
  const now = Date.now();
  if (scanCache && scanCache.key === cacheKey && now - scanCache.timestamp < CACHE_TTL_MS) {
    return scanCache.skills;
  }

  // 扫描两个目录
  const globalSkills = scanSkillDirectory(globalSkillDir, 'global');
  const projectSkills = scanSkillDirectory(projectSkillDir, 'project');

  // 合并：项目级优先覆盖全局同名 Skill
  const skillMap = new Map<string, SkillInfo>();

  // 先添加全局 Skills
  for (const skill of globalSkills) {
    skillMap.set(skill.name, skill);
  }

  // 再添加项目级 Skills（覆盖同名）
  for (const skill of projectSkills) {
    skillMap.set(skill.name, skill);
  }

  const result = Array.from(skillMap.values());

  // 更新缓存
  scanCache = { skills: result, timestamp: now, key: cacheKey };

  logger.debug({
    globalCount: globalSkills.length,
    projectCount: projectSkills.length,
    totalCount: result.length,
  }, 'Skills scanned');

  return result;
}

/**
 * 清除扫描缓存（用于测试）
 */
export function clearScanCache(): void {
  scanCache = null;
}