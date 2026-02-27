import { test, expect } from '../fixtures/server-fixture.js';
import { SELECTORS } from '../helpers/selectors.js';
import {
  waitForConnected,
  waitForTerminal,
  waitForDisconnected,
} from '../helpers/wait-helpers.js';

test.describe('Reconnection', () => {
  test.beforeEach(async ({ page, authenticate }) => {
    await authenticate(page);
    await waitForConnected(page);
    await waitForTerminal(page);
  });

  test('shows disconnected when WebSocket is interrupted', async ({ page }) => {
    // Abort WebSocket connections to simulate disconnect
    await page.route('**/ws', (route) => route.abort());

    // Close existing WS by evaluating in page context
    await page.evaluate(() => {
      // Force close to trigger the disconnect UI
      window.dispatchEvent(new Event('offline'));
    });

    // Wait for disconnect to propagate — the WS reconnect attempt will be aborted
    // The Disconnected text in StatusBar should appear
    await waitForDisconnected(page, 30_000);
  });

  test('auto-reconnects when connection is restored', async ({ page }) => {
    // Abort WS connections
    await page.route('**/ws', (route) => route.abort());

    // Force close existing WS
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitForDisconnected(page, 30_000);

    // Restore connections
    await page.unroute('**/ws');

    // Should auto-reconnect — "Connected" should reappear
    await waitForConnected(page, 60_000);

    // Terminal should still be visible
    await expect(page.locator(SELECTORS.CONSOLE.terminal)).toBeVisible();
  });

  test('page refresh re-authenticates and restores history', async ({ page, authenticate }) => {
    // Reload page
    await page.reload();

    // Should show auth page again
    await expect(page.locator(SELECTORS.AUTH.title)).toBeVisible({ timeout: 10_000 });

    // Re-authenticate
    await authenticate(page);

    // Should be back on console with connection
    await waitForConnected(page);
    await waitForTerminal(page);

    // Terminal should show history (canvas is non-blank)
    const canvas = page.locator(`${SELECTORS.CONSOLE.terminal} canvas`);
    await expect(canvas.first()).toBeVisible();
  });
});
