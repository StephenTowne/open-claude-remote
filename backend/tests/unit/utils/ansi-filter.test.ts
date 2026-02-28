import { describe, it, expect, beforeEach } from 'vitest';
import { AlternateScreenFilter } from '../../../src/utils/ansi-filter.js';

describe('AlternateScreenFilter', () => {
  let filter: AlternateScreenFilter;

  beforeEach(() => {
    filter = new AlternateScreenFilter();
  });

  describe('初始状态', () => {
    it('初始时不处于 alternate screen 模式', () => {
      expect(filter.inAlternateScreen).toBe(false);
    });
  });

  describe('检测 alternate screen 切换', () => {
    it('检测 \\x1b[?1049h 进入 alternate screen', () => {
      const result = filter.process('\x1b[?1049h');
      expect(filter.inAlternateScreen).toBe(true);
      expect(result).toBe(''); // 进入时不返回内容
    });

    it('检测 \\x1b[?1049l 退出 alternate screen', () => {
      filter.process('\x1b[?1049h'); // 进入
      const result = filter.process('\x1b[?1049l'); // 退出
      expect(filter.inAlternateScreen).toBe(false);
      expect(result).toBe(''); // 退出时不返回内容
    });

    it('检测 \\x1b[?47h 进入 alternate screen（旧格式）', () => {
      const result = filter.process('\x1b[?47h');
      expect(filter.inAlternateScreen).toBe(true);
      expect(result).toBe('');
    });

    it('检测 \\x1b[?47l 退出 alternate screen（旧格式）', () => {
      filter.process('\x1b[?47h');
      const result = filter.process('\x1b[?47l');
      expect(filter.inAlternateScreen).toBe(false);
      expect(result).toBe('');
    });
  });

  describe('过滤输出', () => {
    it('在主 screen 时返回正常输出', () => {
      const result = filter.process('Hello World');
      expect(result).toBe('Hello World');
    });

    it('在 alternate screen 时返回空字符串', () => {
      filter.process('\x1b[?1049h');
      const result = filter.process('Interactive content');
      expect(result).toBe('');
    });

    it('退出 alternate screen 后恢复输出', () => {
      filter.process('\x1b[?1049h');
      filter.process('\x1b[?1049l');
      const result = filter.process('Back to normal');
      expect(result).toBe('Back to normal');
    });
  });

  describe('混合输出处理', () => {
    it('包含进入序列的混合输出', () => {
      const result = filter.process('Normal text\x1b[?1049hInteractive content');
      expect(filter.inAlternateScreen).toBe(true);
      // 进入序列之前的内容应该被返回
      expect(result).toBe('Normal text');
    });

    it('包含退出序列的混合输出', () => {
      filter.process('\x1b[?1049h');
      const result = filter.process('Interactive\x1b[?1049lNormal after');
      expect(filter.inAlternateScreen).toBe(false);
      // 退出序列之后的内容应该被返回
      expect(result).toBe('Normal after');
    });

    it('包含 ANSI 颜色码的正常输出不被过滤', () => {
      const coloredText = '\x1b[31mRed text\x1b[0m';
      const result = filter.process(coloredText);
      expect(result).toBe(coloredText);
    });
  });

  describe('边界情况', () => {
    it('空字符串处理', () => {
      const result = filter.process('');
      expect(result).toBe('');
      expect(filter.inAlternateScreen).toBe(false);
    });

    it('连续多次进入/退出', () => {
      filter.process('\x1b[?1049h');
      filter.process('\x1b[?1049l');
      filter.process('\x1b[?1049h');
      expect(filter.inAlternateScreen).toBe(true);
      filter.process('\x1b[?1049l');
      expect(filter.inAlternateScreen).toBe(false);
    });

    it('切分的数据：序列跨越多个 chunk', () => {
      // 模拟序列被切分
      filter.process('\x1b[?10');
      const result = filter.process('49h');
      expect(filter.inAlternateScreen).toBe(true);
    });

    it('切分的数据：另一种切分方式', () => {
      filter.process('\x1b');
      filter.process('[?1049h');
      expect(filter.inAlternateScreen).toBe(true);
    });
  });

  describe('实际场景模拟', () => {
    it('模拟 Claude Code 斜杠命令选择流程', () => {
      // 正常输出
      let result = filter.process('Hello, I am Claude\n');
      expect(result).toBe('Hello, I am Claude\n');

      // 用户触发命令选择，进入 alternate screen
      result = filter.process('\x1b[?1049h'); // 清屏并切换
      expect(result).toBe('');
      expect(filter.inAlternateScreen).toBe(true);

      // 交互式选择内容（下拉菜单）
      result = filter.process('\x1b[2J\x1b[H/commit\n/feature-dev\n');
      expect(result).toBe(''); // 被过滤

      // 用户选择完成，退出 alternate screen
      result = filter.process('\x1b[?1049l');
      expect(result).toBe('');
      expect(filter.inAlternateScreen).toBe(false);

      // 恢复正常输出
      result = filter.process('Running command...\n');
      expect(result).toBe('Running command...\n');
    });
  });
});