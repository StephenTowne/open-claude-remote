import { useRef, useEffect, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';

const DEFAULT_FONT_SIZE = 14;
// 7 是移动端可读性的最小字号下限，继续降低会明显影响可读性
const MIN_FONT_SIZE = 7;
const MIN_USABLE_ROWS = 12;

export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  onResize?: (cols: number, rows: number) => void,
) {
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyColsRef = useRef<number | null>(null);
  const adaptFnRef = useRef<((ptyCols: number) => void) | null>(null);

  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      disableStdin: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#e6edf3',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      scrollback: 10000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);

    // Try WebGL renderer, fallback to canvas
    try {
      const webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
    } catch {
      // Canvas renderer is the default fallback
    }

    fitAddon.fit();
    // 初始尺寸通知：等布局稳定后上报
    requestAnimationFrame(() => {
      if (onResizeRef.current && termRef.current) {
        onResizeRef.current(termRef.current.cols, termRef.current.rows);
      }
    });
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // 字体适配函数：缩小字体让 xterm 列数尽量匹配 PTY 宽度
    const adaptToPtyColsInner = (ptyCols: number) => {
      ptyColsRef.current = ptyCols;

      // 重置到默认字体以获取基准列数
      term.options.fontSize = DEFAULT_FONT_SIZE;
      const dims = fitAddon.proposeDimensions();
      const baseCols = dims?.cols ?? 0;

      if (baseCols >= ptyCols) {
        fitAddon.fit();
        return;
      }

      // 按比例缩小字体
      const targetFontSize = DEFAULT_FONT_SIZE * (baseCols / ptyCols);
      const nextFontSize = Math.max(MIN_FONT_SIZE, Math.round(targetFontSize));
      term.options.fontSize = nextFontSize;
      fitAddon.fit();

      // 行数过低时尝试回退 1 级字体，避免可视高度过低
      if (term.rows < MIN_USABLE_ROWS && nextFontSize < DEFAULT_FONT_SIZE) {
        term.options.fontSize = Math.min(DEFAULT_FONT_SIZE, nextFontSize + 1);
        fitAddon.fit();
      }
    };
    adaptFnRef.current = adaptToPtyColsInner;

    const resizeObserver = new ResizeObserver(() => {
      if (ptyColsRef.current !== null) {
        // 移动端模式：重新适配字体，不触发 onResize（PC terminal-relay 是唯一 resize 来源）
        adaptFnRef.current?.(ptyColsRef.current);
      } else {
        fitAddon.fit();
        if (onResizeRef.current) {
          onResizeRef.current(term.cols, term.rows);
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      adaptFnRef.current = null;
    };
  }, [containerRef]);

  const write = useCallback((data: string, callback?: () => void) => {
    termRef.current?.write(data, callback);
  }, []);

  const clear = useCallback(() => {
    termRef.current?.clear();
  }, []);

  const scrollToBottom = useCallback(() => {
    termRef.current?.scrollToBottom();
  }, []);

  const adaptToPtyCols = useCallback((ptyCols: number) => {
    adaptFnRef.current?.(ptyCols);
  }, []);

  return { write, clear, scrollToBottom, adaptToPtyCols, terminal: termRef };
}
