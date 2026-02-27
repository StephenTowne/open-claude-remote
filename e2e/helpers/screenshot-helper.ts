import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SELECTORS } from './selectors.js';

/**
 * Take a screenshot of the xterm.js terminal and compare against baseline.
 * Uses generous tolerances because:
 * - Canvas font rendering varies across machines
 * - Claude responses are non-deterministic
 */
export async function expectTerminalSnapshot(
  page: Page,
  name: string,
  options?: { maxDiffPixelRatio?: number; threshold?: number },
) {
  const terminal = page.locator(SELECTORS.CONSOLE.terminal);
  await expect(terminal).toHaveScreenshot(`terminal-${name}.png`, {
    maxDiffPixelRatio: options?.maxDiffPixelRatio ?? 0.2,
    threshold: options?.threshold ?? 0.3,
  });
}

/**
 * Take a full page screenshot and compare against baseline.
 */
export async function expectPageSnapshot(
  page: Page,
  name: string,
  options?: { maxDiffPixelRatio?: number; threshold?: number },
) {
  await expect(page).toHaveScreenshot(`page-${name}.png`, {
    maxDiffPixelRatio: options?.maxDiffPixelRatio ?? 0.1,
    threshold: options?.threshold ?? 0.3,
  });
}

/**
 * Take a terminal screenshot and return it for manual comparison (not baseline).
 * Useful for "before/after" tests where we just need to verify content changed.
 */
export async function takeTerminalScreenshot(page: Page): Promise<Buffer> {
  const terminal = page.locator(SELECTORS.CONSOLE.terminal);
  return await terminal.screenshot();
}
