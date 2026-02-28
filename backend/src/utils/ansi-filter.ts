/**
 * Alternate Screen Buffer 过滤器
 *
 * 检测 PTY 输出中的 alternate screen buffer 切换序列（\x1b[?1049h/l），
 * 在交互式 UI 模式时过滤输出，避免 web 端显示错位。
 *
 * 典型场景：Claude Code 斜杠命令选择时，下拉菜单使用 alternate screen，
 * 其 ANSI 定位序列基于 PC 终端尺寸，在 web 端会导致内容错位重叠。
 */

/** 进入 alternate screen 的 ANSI 序列 */
const ALT_SCREEN_ENTER_REGEX = /\x1b\[\?(1049|47)h/;

/** 退出 alternate screen 的 ANSI 序列 */
const ALT_SCREEN_EXIT_REGEX = /\x1b\[\?(1049|47)l/;

/** ANSII ESC 字符 */
const ESC = '\x1b';

/**
 * Alternate Screen Buffer 状态过滤
 *
 * 维护 alternate screen 状态，处理流式数据中可能被切分的 ANSI 序列。
 */
export class AlternateScreenFilter {
  private _inAlternateScreen: boolean = false;
  private pending: string = '';

  /** 当前是否处于 alternate screen 模式 */
  get inAlternateScreen(): boolean {
    return this._inAlternateScreen;
  }

  /**
   * 处理 PTY 输出数据
   *
   * @param data - PTY 输出的原始 ANSI 字符串
   * @returns 过滤后的数据（alternate screen 期间返回空字符串）
   */
  process(data: string): string {
    // 合并上次可能未完成的序列
    const combined = this.pending + data;
    this.pending = '';

    // 处理完整数据
    return this.processData(combined);
  }

  /**
   * 处理数据并返回过滤后的内容
   */
  private processData(data: string): string {
    // 查找所有进入和退出序列的位置
    const segments: Array<{ type: 'enter' | 'exit' | 'content'; index: number; length: number }> = [];

    // 找出所有进入序列
    let match;
    const enterRegex = new RegExp(ALT_SCREEN_ENTER_REGEX.source, 'g');
    while ((match = enterRegex.exec(data)) !== null) {
      segments.push({ type: 'enter', index: match.index, length: match[0].length });
    }

    // 找出所有退出序列
    const exitRegex = new RegExp(ALT_SCREEN_EXIT_REGEX.source, 'g');
    while ((match = exitRegex.exec(data)) !== null) {
      segments.push({ type: 'exit', index: match.index, length: match[0].length });
    }

    // 按位置排序
    segments.sort((a, b) => a.index - b.index);

    // 如果没有找到任何序列
    if (segments.length === 0) {
      // 检查是否有未完成的序列需要保存
      this.savePendingIncomplete(data);

      if (this._inAlternateScreen) {
        return '';
      }
      return data;
    }

    // 构建结果
    let result = '';
    let currentPos = 0;
    let inAltScreen = this._inAlternateScreen;

    for (const seg of segments) {
      // 处理序列之前的内容（如果有）
      if (seg.index > currentPos) {
        const content = data.slice(currentPos, seg.index);
        if (!inAltScreen) {
          result += content;
        }
      }

      // 更新状态
      if (seg.type === 'enter') {
        inAltScreen = true;
      } else {
        inAltScreen = false;
      }

      currentPos = seg.index + seg.length;
    }

    // 处理最后一个序列之后的内容
    if (currentPos < data.length) {
      const remaining = data.slice(currentPos);

      // 检查是否有未完成的序列
      const hasIncomplete = this.savePendingIncomplete(remaining);

      if (inAltScreen && !hasIncomplete) {
        // 在 alternate screen 中，且剩余部分是完整内容
        // 不返回任何内容
      } else if (!inAltScreen) {
        // 不在 alternate screen 中
        if (hasIncomplete) {
          // 有未完成的序列，只返回不完整的序列之前的内容
          const escIndex = remaining.lastIndexOf(ESC);
          if (escIndex > 0) {
            result += remaining.slice(0, escIndex);
          }
        } else {
          result += remaining;
        }
      }
    }

    // 更新最终状态
    this._inAlternateScreen = inAltScreen;

    return result;
  }

  /**
   * 保存可能不完整的序列
   * @returns 是否保存了未完成的序列
   */
  private savePendingIncomplete(data: string): boolean {
    // 查找最后一个 ESC 字符的位置
    const lastEscIndex = data.lastIndexOf(ESC);

    if (lastEscIndex !== -1) {
      const afterEsc = data.slice(lastEscIndex);

      // 如果 ESC 后面内容太短（完整的序列至少 7 字符），可能是不完整的序列
      if (afterEsc.length < 7) {
        // 检查是否已经是完整序列
        const isCompleteEnter = ALT_SCREEN_ENTER_REGEX.test(afterEsc);
        const isCompleteExit = ALT_SCREEN_EXIT_REGEX.test(afterEsc);

        if (!isCompleteEnter && !isCompleteExit) {
          this.pending = afterEsc;
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 重置状态
   */
  reset(): void {
    this._inAlternateScreen = false;
    this.pending = '';
  }
}
