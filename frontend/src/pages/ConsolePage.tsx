import { useRef, useCallback, useEffect, useState } from 'react';
import type { ServerMessage, InstanceListItem } from '@claude-remote/shared';
import { StatusBar } from '../components/status/StatusBar.js';
import { TerminalView } from '../components/terminal/TerminalView.js';
import { InputBar } from '../components/input/InputBar.js';
import { VirtualKeyBar } from '../components/input/VirtualKeyBar.js';
import { PromptSelector } from '../components/input/PromptSelector.js';
import { ConnectionBanner } from '../components/common/ConnectionBanner.js';
import { InstanceTabs } from '../components/instances/InstanceTabs.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useTerminal } from '../hooks/useTerminal.js';
import { useViewport } from '../hooks/useViewport.js';
import { usePushNotification } from '../hooks/usePushNotification.js';
import { useInstances } from '../hooks/useInstances.js';
import { useAppStore } from '../stores/app-store.js';
import { useInstanceStore } from '../stores/instance-store.js';
import { authenticateToInstance, buildInstanceWsUrl } from '../services/instance-api.js';

// 检测 Claude Code 选项提示的标记文本（底部提示栏固定内容）
const PROMPT_MARKER = 'Tab/Arrow keys to navigate';

// 选项行格式：捕获组 1 = 前缀（空格或 ❯），捕获组 2 = 序号，捕获组 3 = 标签文本
// 不包含 > 避免误匹配 shell prompt、git 输出等普通 > 开头的行
const OPTION_LINE_RE = /^([\s❯]*)(\d+)\.\s+(.+)/;

interface PromptState {
  options: string[];
  selectedIndex: number;
}

function detectPromptFromLines(lines: string[]): PromptState | null {
  if (!lines.some((l) => l.includes(PROMPT_MARKER))) return null;

  const options: string[] = [];
  let selectedIndex = 0;

  for (const line of lines) {
    const match = line.match(OPTION_LINE_RE);
    if (!match) continue;

    // 直接用捕获组 1（前缀部分）判断是否含 ❯
    const isSelected = match[1].includes('❯');
    if (isSelected) selectedIndex = options.length;

    options.push(match[3].trim());
  }

  return options.length > 0 ? { options, selectedIndex } : null;
}

function ConsoleContent({ wsUrl, instanceId, showVirtualKeyBar }: { wsUrl?: string; instanceId?: string; showVirtualKeyBar: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setSessionStatus = useAppStore((s) => s.setSessionStatus);

  // 用 ref 打破循环依赖：handleMessage ↔ write，send ↔ onResize
  const sendRef = useRef<ReturnType<typeof useWebSocket>['send'] | null>(null);
  // 初始值为 no-op，在 useTerminal 返回真实函数后立即更新
  const writeRef = useRef((_data: string, _cb?: () => void) => {});
  const scrollToBottomRef = useRef(() => {});
  const readLastLinesRef = useRef((_n?: number): string[] => []);

  // 当前检测到的交互式选项提示状态（null 表示无提示）
  const [promptState, setPromptState] = useState<PromptState | null>(null);
  const promptStateRef = useRef<PromptState | null>(null);

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'terminal_output':
        // 写入 xterm 后，通过 callback 扫描 buffer 检测选项提示
        writeRef.current(msg.data, () => {
          const lines = readLastLinesRef.current(60);
          const detected = detectPromptFromLines(lines);
          // 仅在状态实际变化时更新，避免无效重渲染
          const prev = promptStateRef.current;
          const changed = detected === null
            ? prev !== null
            : prev === null ||
              prev.options.length !== detected.options.length ||
              prev.selectedIndex !== detected.selectedIndex ||
              prev.options.some((option, idx) => option !== detected.options[idx]);
          if (changed) {
            promptStateRef.current = detected;
            setPromptState(detected);
          }
        });
        scrollToBottomRef.current();
        break;
      case 'history_sync':
        writeRef.current(msg.data);
        setSessionStatus(msg.status);
        // fitAddon 控制尺寸，并自动通知后端，无需强制 resize xterm
        scrollToBottomRef.current();
        break;
      case 'terminal_resize':
        // PTY 尺寸变化通知（忽略，xterm 以 fitAddon 为准）
        break;
      case 'status_update':
        setSessionStatus(msg.status);
        break;
      case 'session_ended':
        setSessionStatus('idle');
        break;
      case 'error':
        writeRef.current(`\r\n\x1b[31m[Error] ${msg.message}\x1b[0m\r\n`);
        break;
    }
  }, [setSessionStatus]);

  const { connect, send } = useWebSocket(handleMessage, wsUrl, instanceId);
  sendRef.current = send;

  const { write, scrollToBottom, readLastLines } = useTerminal(
    containerRef,
    useCallback((cols: number, rows: number) => {
      // 移动端窄视口（< 80 cols）不发送 resize，避免覆盖 PC 端 PTY 尺寸
      if (cols >= 80) {
        sendRef.current?.({ type: 'resize', cols, rows });
      }
    }, []),
  );

  // 每次渲染后同步 ref，确保 handleMessage 中调用的是最新版本
  writeRef.current = write;
  scrollToBottomRef.current = scrollToBottom;
  readLastLinesRef.current = readLastLines;

  // Connect only once on mount
  const connectCalledRef = useRef(false);
  useEffect(() => {
    if (!connectCalledRef.current) {
      connectCalledRef.current = true;
      connect();
    }
  }, [connect]);

  const handleSend = useCallback((text: string) => {
    if (text) {
      send({ type: 'user_input', data: text });
      setTimeout(() => {
        send({ type: 'user_input', data: '\r' });
      }, 0);
    } else {
      send({ type: 'user_input', data: '\r' });
    }
  }, [send]);

  const handleKeyPress = useCallback((data: string) => {
    send({ type: 'user_input', data });
  }, [send]);

  // 点击选项：发送方向键导航到目标选项，然后发送 Enter 确认
  const handlePromptSelect = useCallback((targetIndex: number) => {
    const current = promptStateRef.current;
    if (!current) return;

    const diff = targetIndex - current.selectedIndex;
    const arrowKey = diff > 0 ? '\x1b[B' : '\x1b[A';
    for (let i = 0; i < Math.abs(diff); i++) {
      send({ type: 'user_input', data: arrowKey });
    }
    send({ type: 'user_input', data: '\r' });

    // 立即收起 UI，下一次 terminal_output 会重新扫描确认状态
    promptStateRef.current = null;
    setPromptState(null);
  }, [send]);

  return (
    <>
      <ConnectionBanner />
      <TerminalView containerRef={containerRef} />
      {promptState ? (
        <PromptSelector
          options={promptState.options}
          selectedIndex={promptState.selectedIndex}
          onSelect={handlePromptSelect}
        />
      ) : (
        <>
          <VirtualKeyBar onKeyPress={handleKeyPress} visible={showVirtualKeyBar} />
          <InputBar onSend={handleSend} />
        </>
      )}
    </>
  );
}

function getAutoSwitchCandidates(instances: InstanceListItem[], currentInstanceId: string, currentPort?: number) {
  const sorted = instances
    .filter((instance) => instance.instanceId !== currentInstanceId)
    .sort((a, b) => a.port - b.port);

  if (sorted.length === 0) {
    return [];
  }

  if (currentPort === undefined) {
    return sorted;
  }

  const startIndex = sorted.findIndex((instance) => instance.port > currentPort);
  if (startIndex === -1) {
    return sorted;
  }

  return [...sorted.slice(startIndex), ...sorted.slice(0, startIndex)];
}

export function ConsolePage() {
  const { keyboardHeight } = useViewport();
  const showVirtualKeyBar = keyboardHeight === 0;

  usePushNotification();
  useInstances();

  const instances = useInstanceStore((s) => s.instances);
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);
  const setActiveInstanceId = useInstanceStore((s) => s.setActiveInstanceId);

  const cachedToken = useAppStore((s) => s.cachedToken);
  const instanceConnectionStatus = useAppStore((s) => s.instanceConnectionStatus);
  const toastMessage = useAppStore((s) => s.toastMessage);
  const showToast = useAppStore((s) => s.showToast);
  const hideToast = useAppStore((s) => s.hideToast);

  const isAutoSwitchingRef = useRef(false);
  const lastSwitchSourceRef = useRef<string | null>(null);
  const lastKnownActivePortRef = useRef<number | undefined>(undefined);

  // 计算当前活跃实例的 WS URL
  const activeInstance = instances.find(i => i.instanceId === activeInstanceId);
  const isCurrent = activeInstance?.isCurrent ?? true;
  const wsUrl = activeInstance && !isCurrent
    ? buildInstanceWsUrl(activeInstance.host, activeInstance.port)
    : undefined; // undefined = 使用默认（当前实例）

  useEffect(() => {
    if (activeInstance?.port !== undefined) {
      lastKnownActivePortRef.current = activeInstance.port;
    }
  }, [activeInstance]);

  useEffect(() => {
    if (!activeInstanceId) {
      return;
    }

    const activeMissing = !activeInstance;
    const activeDisconnected = instanceConnectionStatus[activeInstanceId] === 'disconnected';
    const shouldAutoSwitch = activeMissing || activeDisconnected;

    if (!shouldAutoSwitch || isAutoSwitchingRef.current) {
      return;
    }

    if (lastSwitchSourceRef.current === activeInstanceId) {
      return;
    }

    const currentPort = activeInstance?.port ?? lastKnownActivePortRef.current;
    const candidates = getAutoSwitchCandidates(instances, activeInstanceId, currentPort);
    if (candidates.length === 0) {
      return;
    }

    isAutoSwitchingRef.current = true;
    lastSwitchSourceRef.current = activeInstanceId;

    const run = async () => {
      for (const candidate of candidates) {
        if (!candidate.isCurrent && cachedToken) {
          try {
            const authenticated = await authenticateToInstance(candidate.host, candidate.port, cachedToken);
            if (!authenticated) {
              continue;
            }
          } catch {
            continue;
          }
        }

        setActiveInstanceId(candidate.instanceId);
        showToast(`已切换到 ${candidate.port}`);
        break;
      }

      isAutoSwitchingRef.current = false;
    };

    void run();
  }, [
    activeInstance,
    activeInstanceId,
    cachedToken,
    instanceConnectionStatus,
    instances,
    setActiveInstanceId,
    showToast,
  ]);

  // 自动消失：toast 显示 3s 后关闭
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => hideToast(), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage, hideToast]);

  const handleInstanceSwitch = useCallback(async (targetId: string) => {
    const target = instances.find(i => i.instanceId === targetId);
    if (!target) return;

    // 如果目标不是当前实例，需要先认证
    if (!target.isCurrent && cachedToken) {
      try {
        await authenticateToInstance(target.host, target.port, cachedToken);
      } catch {
        // 认证失败时仍然切换，WS 连接会失败并显示 Disconnected
      }
    }

    setActiveInstanceId(targetId);
  }, [instances, cachedToken, setActiveInstanceId]);

  return (
    <div data-testid="console-page" style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: keyboardHeight > 0 ? keyboardHeight : undefined,
      transition: 'padding-bottom 0.15s ease-out',
    }}>
      <StatusBar />
      <InstanceTabs onSwitch={handleInstanceSwitch} />
      {/* key=activeInstanceId 强制 React 重建整个终端+WS */}
      <ConsoleContent
        key={activeInstanceId ?? 'default'}
        wsUrl={wsUrl}
        instanceId={activeInstanceId ?? undefined}
        showVirtualKeyBar={showVirtualKeyBar}
      />
      {toastMessage && <div className="app-toast" role="status" aria-live="polite">{toastMessage}</div>}
    </div>
  );
}
