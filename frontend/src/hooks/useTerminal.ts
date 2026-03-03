import { useRef, useEffect, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { Unicode11Addon } from '@xterm/addon-unicode11';

const WRITE_FLUSH_INTERVAL_MS = 16;
const WRITE_MAX_QUEUED_BYTES = 256 * 1024;
const RESIZE_THROTTLE_MS = 50;

export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  onResize?: (cols: number, rows: number) => boolean | void,
) {
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const adaptFnRef = useRef<((ptyCols: number, ptyRows?: number) => void) | null>(null);

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

  // 用于取消程序滚动的 RAF 回调
  const scrollRafIdRef = useRef<number | null>(null);

  const autoFollowRef = useRef(true);
  const isAtBottomRef = useRef(true);
  // 计数器机制：只跳过指定数量的程序滚动事件，避免持续输出时用户滚动被忽略
  const scrollEventSkipCountRef = useRef(0);
  const [showScrollHint, setShowScrollHint] = useState(false);

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
        // 只在成功发送时更新 lastReportedResizeRef
        const sent = onResizeRef.current?.(cols, rows);
        if (sent !== false) {
          lastReportedResizeRef.current = { cols, rows };
        }
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
            // 只在成功发送时更新 lastReportedResizeRef
            const sent = onResizeRef.current?.(pending.cols, pending.rows);
            if (sent !== false) {
              lastReportedResizeRef.current = { cols: pending.cols, rows: pending.rows };
            }
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

    const adaptToPtySizeInner = (_ptyCols: number, _ptyRows?: number) => {
      fitAddon.fit();
      // 主动上报 resize，确保 PTY 了解当前终端尺寸
      // 这在 history_sync 后尤为重要：移动端连接时需要让 PTY 调整到移动端的实际尺寸
      emitResize(term.cols, term.rows);
    };
    adaptFnRef.current = adaptToPtySizeInner;

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      emitResize(term.cols, term.rows);
    });
    resizeObserver.observe(containerRef.current);

    // 监听滚动事件，实现智能 auto-follow
    term.onScroll(() => {
      // 计数器机制：跳过程序触发的滚动事件
      // 每次 scrollToBottom 调用前设置 count = 1，只跳过一个 onScroll 事件
      // 避免 PTY 持续输出时用户滚动被忽略的问题
      if (scrollEventSkipCountRef.current > 0) {
        scrollEventSkipCountRef.current--;
        return;
      }

      const buffer = term.buffer.active;
      const atBottom = buffer.viewportY === buffer.length - term.rows;
      isAtBottomRef.current = atBottom;

      // 用户向上滚动且不在底部时，自动关闭 auto-follow
      if (!atBottom && autoFollowRef.current) {
        autoFollowRef.current = false;
      }

      // 驱动 UI 按钮显隐（ref → state 桥接）
      setShowScrollHint(!autoFollowRef.current && !atBottom);
    });

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
      if (scrollRafIdRef.current !== null) {
        cancelAnimationFrame(scrollRafIdRef.current);
        scrollRafIdRef.current = null;
      }
      flushWriteQueue();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      adaptFnRef.current = null;
      flushWriteQueueRef.current = null;
    };
  }, [containerRef]);

  // 智能 auto-scroll：auto-follow 开启时滚动到底部，否则检测按钮显隐
  const autoScrollIfNeeded = useCallback(() => {
    const term = termRef.current;
    if (!term) return;

    if (autoFollowRef.current) {
      scrollRafIdRef.current = requestAnimationFrame(() => {
        scrollRafIdRef.current = null;
        // RAF 后自动重置计数器，确保下次用户滚动能正常响应
      });
      // 设置计数器为 1，只跳过一个 onScroll 事件
      scrollEventSkipCountRef.current = 1;
      term.scrollToBottom();
      return;
    }

    // auto-follow 关闭时，检测新内容是否将用户推离底部
    const buffer = term.buffer.active;
    const atBottom = buffer.viewportY === buffer.length - term.rows;
    if (atBottom !== isAtBottomRef.current) {
      isAtBottomRef.current = atBottom;
      setShowScrollHint(!atBottom);
    }
  }, []);

  const write = useCallback((data: string, callback?: () => void) => {
    if (!data) {
      callback?.();
      return;
    }
    writeQueueRef.current.push(data);
    queuedWriteBytesRef.current += data.length;

    if (queuedWriteBytesRef.current >= WRITE_MAX_QUEUED_BYTES) {
      flushWriteQueueRef.current?.();
      autoScrollIfNeeded();
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
        autoScrollIfNeeded();
      });
    }

    if (!writeFlushTimeoutRef.current) {
      writeFlushTimeoutRef.current = setTimeout(() => {
        writeFlushTimeoutRef.current = null;
        flushWriteQueueRef.current?.();
        autoScrollIfNeeded();
      }, WRITE_FLUSH_INTERVAL_MS);
    }

    callback?.();
  }, []);

  const clear = useCallback(() => {
    termRef.current?.clear();
  }, []);

  const reset = useCallback(() => {
    termRef.current?.reset();
  }, []);

  const scrollToBottom = useCallback(() => {
    const term = termRef.current;
    if (!term) return;

    scrollRafIdRef.current = requestAnimationFrame(() => {
      scrollRafIdRef.current = null;
      // RAF 后自动重置计数器，确保下次用户滚动能正常响应
    });
    // 设置计数器为 1，只跳过一个 onScroll 事件
    scrollEventSkipCountRef.current = 1;
    term.scrollToBottom();
  }, []);

  const setAutoFollow = useCallback((enabled: boolean) => {
    autoFollowRef.current = enabled;
    if (enabled) {
      setShowScrollHint(false);
    }
  }, []);

  const adaptToPtyCols = useCallback((ptyCols: number, ptyRows?: number) => {
    adaptFnRef.current?.(ptyCols, ptyRows);
  }, []);

  return {
    write,
    clear,
    reset,
    scrollToBottom,
    setAutoFollow,
    showScrollHint,
    adaptToPtyCols,
    terminal: termRef,
  };
}
