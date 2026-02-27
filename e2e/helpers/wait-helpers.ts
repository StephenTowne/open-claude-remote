import type { Page } from '@playwright/test';
import { SELECTORS } from './selectors.js';

/**
 * Wait for WebSocket connection to be established (StatusBar shows "Connected").
 */
export async function waitForConnected(page: Page, timeout = 30_000) {
  await page.getByText('Connected', { exact: true }).waitFor({
    state: 'visible',
    timeout,
  });
}

/**
 * Wait for a specific session status to appear in the StatusBar.
 */
export async function waitForStatus(
  page: Page,
  status: 'Running' | 'Waiting' | 'Idle',
  timeout = 30_000,
) {
  await page.getByText(status, { exact: true }).waitFor({
    state: 'visible',
    timeout,
  });
}

/**
 * Wait for the approval card to appear.
 * Uses a longer default timeout since it depends on Claude processing a command
 * that triggers tool use.
 */
export async function waitForApprovalCard(page: Page, timeout = 120_000) {
  await page.getByText('Approval Required').waitFor({
    state: 'visible',
    timeout,
  });
}

/**
 * Wait for the approval card to disappear after approve/reject.
 */
export async function waitForApprovalDismissed(page: Page, timeout = 30_000) {
  await page.getByText('Approval Required').waitFor({
    state: 'hidden',
    timeout,
  });
}

/**
 * Wait for the terminal container to be present and rendered.
 */
export async function waitForTerminal(page: Page, timeout = 30_000) {
  await page.locator(SELECTORS.CONSOLE.terminal).waitFor({
    state: 'visible',
    timeout,
  });
}

/**
 * Wait for the "Disconnected" banner to appear.
 */
export async function waitForDisconnected(page: Page, timeout = 15_000) {
  await page.getByText('Disconnected', { exact: true }).waitFor({
    state: 'visible',
    timeout,
  });
}
