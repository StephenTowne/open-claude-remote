import type { Page } from '@playwright/test';
import { SELECTORS } from './selectors.js';

/**
 * Take a terminal screenshot and return it for manual comparison (not baseline).
 * Useful for "before/after" tests where we just need to verify content changed.
 */
export async function takeTerminalScreenshot(page: Page): Promise<Buffer> {
  const terminal = page.locator(SELECTORS.CONSOLE.terminal);
  return await terminal.screenshot();
}
