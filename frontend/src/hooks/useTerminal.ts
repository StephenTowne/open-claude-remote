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

  // 自动跟随状态
  const autoFollowRef = useRef(true);
  const isAtBottomRef = useRef(true);
  const [showScrollHint, setShowScrollHint] = useState(false);

  // 用户滚动意图检测（带时间戳）
  const userScrollIntentRef = useRef<'up' | null>(null);
  const userScrollTimestampRef = useRef(0);

  // 程序滚动时间戳（用于区分程序/用户滚动）
  const programScrollTimestampRef = useRef(0);

  // 上一次视口位置（用于计算滚动方向）
  const lastViewportYRef = useRef(0);

  // 阈值配置
  const USER_INTENT_DURATION_MS = 2000;  // 用户意图持续时间
  const PROGRAM_SCROLL_THRESHOLD_MS = 50; // 程序滚动事件判断阈值

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
    lastViewportYRef.current = term.buffer.active.viewportY;

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
      const now = Date.now();

      // 如果是程序滚动触发的事件，跳过
      if (now - programScrollTimestampRef.current < PROGRAM_SCROLL_THRESHOLD_MS) {
        return;
      }

      const buffer = term.buffer.active;
      const viewportY = buffer.viewportY;
      const atBottom = viewportY === buffer.length - term.rows;

      // 检测用户向上滚动意图
      const prevViewportY = lastViewportYRef.current;
      const scrollDelta = prevViewportY - viewportY; // 正值 = 向上滚动

      if (scrollDelta > 0 && !atBottom) {
        // 用户向上滚动了，记录意图
        userScrollIntentRef.current = 'up';
        userScrollTimestampRef.current = now;
        autoFollowRef.current = false;
      }

      lastViewportYRef.current = viewportY;
      isAtBottomRef.current = atBottom;

      // 滚动到底部时恢复自动跟随
      if (atBottom) {
        userScrollIntentRef.current = null;
        autoFollowRef.current = true;
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

    const now = Date.now();

    // 检查用户是否最近有向上滚动的意图
    const hasUserIntent = userScrollIntentRef.current === 'up' &&
      (now - userScrollTimestampRef.current < USER_INTENT_DURATION_MS);

    if (autoFollowRef.current && !hasUserIntent) {
      programScrollTimestampRef.current = Date.now();
      term.scrollToBottom();
      lastViewportYRef.current = term.buffer.active.viewportY;
      return;
    }

    // 检测是否在底部
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

    // 标记为程序滚动
    programScrollTimestampRef.current = Date.now();
    term.scrollToBottom();
    lastViewportYRef.current = term.buffer.active.viewportY;
  }, []);

  const setAutoFollow = useCallback((enabled: boolean) => {
    autoFollowRef.current = enabled;
    if (enabled) {
      userScrollIntentRef.current = null;  // 清除用户意图
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
