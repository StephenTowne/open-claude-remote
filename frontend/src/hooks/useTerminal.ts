import { useRef, useEffect, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';

export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  onResize?: (cols: number, rows: number) => void,
) {
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

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

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (onResizeRef.current) {
        onResizeRef.current(term.cols, term.rows);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
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

  /**
   * 读取 buffer 末尾最近 n 行的纯文本（xterm 已处理 ANSI，直接返回可见字符）。
   * 用于检测 Claude Code 的交互式选择提示。
   */
  const readLastLines = useCallback((n: number = 50): string[] => {
    const term = termRef.current;
    if (!term) return [];
    const buf = term.buffer.active;
    const end = buf.length;
    const start = Math.max(0, end - n);
    const lines: string[] = [];
    for (let y = start; y < end; y++) {
      const line = buf.getLine(y);
      if (line) lines.push(line.translateToString(true));
    }
    return lines;
  }, []);

  return { write, clear, scrollToBottom, terminal: termRef, readLastLines };
}
