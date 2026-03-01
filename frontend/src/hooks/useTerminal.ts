import { useRef, useEffect, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { Unicode11Addon } from '@xterm/addon-unicode11';

const DEFAULT_FONT_SIZE = 14;
// 7 是移动端可读性的最小字号下限，继续降低会明显影响可读性
const MIN_FONT_SIZE = 7;
const MIN_USABLE_ROWS = 12;
const WRITE_FLUSH_INTERVAL_MS = 16;
const WRITE_MAX_QUEUED_BYTES = 256 * 1024;
const RESIZE_THROTTLE_MS = 50;

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

  const writeQueueRef = useRef<string[]>([]);
  const queuedWriteBytesRef = useRef(0);
  const writeFlushRafIdRef = useRef<number | null>(null);
  const writeFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushWriteQueueRef = useRef<(() => void) | null>(null);

  const lastResizeSentAtRef = useRef(0);
  const pendingResizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingResizeValueRef = useRef<{ cols: number; rows: number } | null>(null);
  const lastReportedResizeRef = useRef<{ cols: number; rows: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const flushWriteQueue = () => {
      if (!termRef.current || writeQueueRef.current.length === 0) return;
      const output = writeQueueRef.current.join('');
      writeQueueRef.current = [];
      queuedWriteBytesRef.current = 0;
      termRef.current.write(output);
    };
    flushWriteQueueRef.current = flushWriteQueue;

    const emitResize = (cols: number, rows: number) => {
      const last = lastReportedResizeRef.current;
      if (last && last.cols === cols && last.rows === rows) {
        return;
      }

      const now = Date.now();
      const elapsed = now - lastResizeSentAtRef.current;
      const run = () => {
        lastResizeSentAtRef.current = Date.now();
        lastReportedResizeRef.current = { cols, rows };
        onResizeRef.current?.(cols, rows);
      };

      if (elapsed >= RESIZE_THROTTLE_MS) {
        run();
        return;
      }

      pendingResizeValueRef.current = { cols, rows };
      if (!pendingResizeTimeoutRef.current) {
        pendingResizeTimeoutRef.current = setTimeout(() => {
          pendingResizeTimeoutRef.current = null;
          const pending = pendingResizeValueRef.current;
          pendingResizeValueRef.current = null;
          if (pending) {
            lastResizeSentAtRef.current = Date.now();
            lastReportedResizeRef.current = { cols: pending.cols, rows: pending.rows };
            onResizeRef.current?.(pending.cols, pending.rows);
          }
        }, RESIZE_THROTTLE_MS - elapsed);
      }
    };

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
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    try {
      const unicode11Addon = new Unicode11Addon();
      term.loadAddon(unicode11Addon);
      term.unicode.activeVersion = '11';
    } catch {
      // fallback to default unicode width behavior
    }

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
      if (termRef.current) {
        emitResize(termRef.current.cols, termRef.current.rows);
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
        emitResize(term.cols, term.rows);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (pendingResizeTimeoutRef.current) {
        clearTimeout(pendingResizeTimeoutRef.current);
        pendingResizeTimeoutRef.current = null;
      }
      if (writeFlushRafIdRef.current !== null) {
        cancelAnimationFrame(writeFlushRafIdRef.current);
        writeFlushRafIdRef.current = null;
      }
      if (writeFlushTimeoutRef.current) {
        clearTimeout(writeFlushTimeoutRef.current);
        writeFlushTimeoutRef.current = null;
      }
      flushWriteQueue();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      adaptFnRef.current = null;
      flushWriteQueueRef.current = null;
    };
  }, [containerRef]);

  const write = useCallback((data: string, callback?: () => void) => {
    if (!data) {
      callback?.();
      return;
    }
    writeQueueRef.current.push(data);
    queuedWriteBytesRef.current += data.length;

    if (queuedWriteBytesRef.current >= WRITE_MAX_QUEUED_BYTES) {
      flushWriteQueueRef.current?.();
      callback?.();
      return;
    }

    if (writeFlushRafIdRef.current === null) {
      writeFlushRafIdRef.current = requestAnimationFrame(() => {
        writeFlushRafIdRef.current = null;
        if (writeFlushTimeoutRef.current) {
          clearTimeout(writeFlushTimeoutRef.current);
          writeFlushTimeoutRef.current = null;
        }
        flushWriteQueueRef.current?.();
      });
    }

    if (!writeFlushTimeoutRef.current) {
      writeFlushTimeoutRef.current = setTimeout(() => {
        writeFlushTimeoutRef.current = null;
        flushWriteQueueRef.current?.();
      }, WRITE_FLUSH_INTERVAL_MS);
    }

    callback?.();
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
