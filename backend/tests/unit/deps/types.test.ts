import { describe, it, expect } from 'vitest';
import {
  DEPENDENCIES,
  parseMajorVersion,
} from '../../../src/deps/types.js';

describe('deps/types', () => {
  describe('DEPENDENCIES 配置', () => {
    it('包含所有必需的依赖', () => {
      expect(DEPENDENCIES.node).toBeDefined();
      expect(DEPENDENCIES.pnpm).toBeDefined();
      expect(DEPENDENCIES.claude).toBeDefined();
    });

    it('每个依赖都有必需的字段', () => {
      for (const dep of Object.values(DEPENDENCIES)) {
        expect(dep.name).toBeDefined();
        expect(dep.displayName).toBeDefined();
        expect(dep.checkCommand).toBeDefined();
        expect(dep.checkArgs).toBeInstanceOf(Array);
        expect(dep.versionRegex).toBeInstanceOf(RegExp);
        expect(dep.helpUrl).toBeDefined();
      }
    });

    it('Node.js 有最低版本要求', () => {
      expect(DEPENDENCIES.node.minVersion).toBe('20');
    });

    it('pnpm 有最低版本要求', () => {
      expect(DEPENDENCIES.pnpm.minVersion).toBe('9');
    });

    it('pnpm 有安装命令', () => {
      expect(DEPENDENCIES.pnpm.installCommands).toBeDefined();
      expect(DEPENDENCIES.pnpm.installCommands!.length).toBeGreaterThan(0);
    });

    it('Claude CLI 有安装命令', () => {
      expect(DEPENDENCIES.claude.installCommands).toBeDefined();
      expect(DEPENDENCIES.claude.installCommands!.length).toBeGreaterThan(0);
    });
  });

  describe('parseMajorVersion', () => {
    it('解析标准版本格式', () => {
      expect(parseMajorVersion('20.0.0')).toBe(20);
      expect(parseMajorVersion('18.17.1')).toBe(18);
    });

    it('解析带 v 前缀的版本', () => {
      expect(parseMajorVersion('v20.0.0')).toBe(20);
      expect(parseMajorVersion('v18.17.1')).toBe(18);
    });

    it('处理无效版本返回 0', () => {
      expect(parseMajorVersion('')).toBe(0);
      expect(parseMajorVersion('invalid')).toBe(0);
    });
  });
});