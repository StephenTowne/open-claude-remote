/**
 * Centralized selectors for E2E tests.
 * Based on actual component markup in frontend/src/.
 */
export const SELECTORS = {
  AUTH: {
    /** Token input field (aria-label="Authentication token") */
    tokenInput: 'input[aria-label="Authentication token"]',
    /** Connect button (type="submit") */
    connectButton: 'button:has-text("Connect")',
    /** Page title */
    title: 'h1:has-text("Claude Code Remote")',
    /** Subtitle */
    subtitle: 'text=Enter the token shown on your PC terminal',
    /** Error message — shown when auth fails */
    errorMessage: 'text=Invalid token',
  },

  CONSOLE: {
    /** StatusBar container — top bar with status indicators */
    statusBar: 'text=Claude Remote',
    /** Session status labels */
    statusRunning: 'text=Running',
    statusWaiting: 'text=Waiting',
    statusIdle: 'text=Idle',
    /** Connection status labels */
    connected: 'text=Connected',
    disconnected: 'text=Disconnected',
    connecting: 'text=Connecting...',
    /** xterm.js terminal container */
    terminal: 'div.xterm',
    /** InputBar input field */
    inputField: 'input[placeholder="Type a message..."]',
    /** InputBar Send button */
    sendButton: 'button:has-text("Send")',
  },

  APPROVAL: {
    /** Approval card title */
    title: 'text=Approval Required',
    /** Approve button */
    approveButton: 'button:has-text("Approve")',
    /** Reject button */
    rejectButton: 'button:has-text("Reject")',
    /** Tool name display */
    toolLabel: 'text=Tool',
    /** Description display */
    descriptionLabel: 'text=Description',
  },

  CONNECTION_BANNER: {
    /** Disconnected banner text */
    disconnected: 'text=Disconnected. Reconnecting...',
    /** Connecting banner text */
    connecting: 'text=Connecting...',
  },
} as const;
