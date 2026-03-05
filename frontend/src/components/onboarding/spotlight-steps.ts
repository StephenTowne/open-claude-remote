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
    id: 'shortcut-bar',
    target: '[data-testid="shortcut-bar"]',
    title: 'Shortcuts',
    description: 'Tap to send common keys like Esc, Enter, Tab. No typing needed.',
    tooltipPosition: 'top',
    spotlightPadding: 4,
    spotlightRadius: 8,
  },
  {
    id: 'command-buttons',
    target: '[data-testid="command-buttons"]',
    title: 'Commands',
    description: 'Preset commands for quick actions.',
    tooltipPosition: 'top',
    spotlightPadding: 4,
    spotlightRadius: 8,
  },
  {
    id: 'input-bar',
    target: '[data-testid="input-bar"]',
    title: 'Input',
    description: 'Type commands or messages here.',
    tooltipPosition: 'top',
    spotlightPadding: 4,
    spotlightRadius: 8,
  },
  {
    id: 'settings-button',
    target: 'button[aria-label="Settings"]',
    title: 'Settings',
    description: 'Customize shortcuts and commands.',
    tooltipPosition: 'bottom',
    spotlightPadding: 4,
    spotlightRadius: 16,
  },
  {
    id: 'add-instance',
    target: 'button[aria-label="Create new instance"]',
    title: 'New Instance',
    description: 'Tap + to create a new Claude Code instance.',
    tooltipPosition: 'bottom',
    spotlightPadding: 4,
    spotlightRadius: 16,
  },
  {
    id: 'instance-tabs',
    target: '[data-testid="instance-tabs"]',
    title: 'Copy Instance',
    description: 'Long press a tab to copy that instance with all settings.',
    tooltipPosition: 'bottom',
    spotlightPadding: 4,
    spotlightRadius: 8,
  },
];

export const STORAGE_KEY = 'claude_remote_spotlight_done';