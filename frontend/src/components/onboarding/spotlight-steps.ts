/**
 * Spotlight 引导步骤配置
 * 目标元素通过 CSS 选择器定位
 */
export interface SpotlightStep {
  id: string;
  target: string;                              // CSS 选择器
  title: string;
  description: string;
  tooltipPosition: 'top' | 'bottom';
  spotlightPadding?: number;
  spotlightRadius?: number;
}

export const SPOTLIGHT_STEPS: SpotlightStep[] = [
  {
    id: 'add-instance',
    target: 'button[aria-label="Create new instance"]',
    title: 'Start Here',
    description: 'Tap + to create a new Claude Code session. Each instance runs independently.',
    tooltipPosition: 'bottom',
    spotlightPadding: 4,
    spotlightRadius: 16,
  },
  {
    id: 'instance-tabs',
    target: '[data-testid="instance-tabs"]',
    title: 'Switch Sessions',
    description: 'Tap any tab to switch between different Claude sessions.',
    tooltipPosition: 'bottom',
    spotlightPadding: 4,
    spotlightRadius: 8,
  },
  {
    id: 'clone-instance',
    target: '[data-testid="instance-tab"]',
    title: 'Clone Sessions',
    description: 'Long press a tab to clone it with all settings. Perfect for backup or testing.',
    tooltipPosition: 'bottom',
    spotlightPadding: 4,
    spotlightRadius: 8,
  },
  {
    id: 'shortcut-bar',
    target: '[data-testid="shortcut-bar"]',
    title: 'Quick Keys',
    description: 'Send Ctrl+C, Tab, Enter etc. instantly without typing.',
    tooltipPosition: 'top',
    spotlightPadding: 4,
    spotlightRadius: 8,
  },
  {
    id: 'command-buttons',
    target: '[data-testid="command-buttons"]',
    title: 'One-Tap Commands',
    description: 'Run preset commands with a single tap.',
    tooltipPosition: 'top',
    spotlightPadding: 4,
    spotlightRadius: 8,
  },
  {
    id: 'input-bar',
    target: '[data-testid="command-input"]',
    title: 'Chat with Claude',
    description: 'Type your message or command here. Claude Code will respond in real-time.',
    tooltipPosition: 'top',
    spotlightPadding: 4,
    spotlightRadius: 8,
  },
  {
    id: 'settings-button',
    target: 'button[aria-label="Settings"]',
    title: 'Customize',
    description: 'Adjust shortcuts, commands, and preferences.',
    tooltipPosition: 'bottom',
    spotlightPadding: 4,
    spotlightRadius: 16,
  },
];

export const STORAGE_KEY = 'claude_remote_spotlight_done';
