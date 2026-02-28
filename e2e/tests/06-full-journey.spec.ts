import { test, expect } from '../fixtures/server-fixture.js';
import { SELECTORS } from '../helpers/selectors.js';
import {
  waitForConnected,
  waitForTerminal,
  waitForStatus,
  waitForApprovalCard,
  waitForApprovalDismissed,
  waitForDisconnected,
} from '../helpers/wait-helpers.js';
import { serverManager } from '../helpers/server-manager.js';

/**
 * Full user journey test — covers the PRD Primary Flow in a single serial test.
 * This test exercises the complete flow end-to-end:
 * 1. Auth page -> authenticate
 * 2. Console view -> verify status
 * 3. Send command -> verify response
 * 4. Trigger approval -> approve
 * 5. Simulate disconnect -> reconnect
 */
test.describe('Full Journey', () => {
  test.beforeAll(async () => {
    await serverManager.start();
  });
  test.afterAll(async () => {
    await serverManager.stop();
  });

  test('complete primary flow', async ({ page, serverUrl, authToken }) => {
    // -- Step 1: Auth Page --
    await page.goto(serverUrl);
    await expect(page.locator(SELECTORS.AUTH.title)).toBeVisible();

    // -- Step 2: Authenticate --
    await page.getByLabel('Authentication token').fill(authToken);
    await page.getByRole('button', { name: 'Connect' }).click();

    // -- Step 3: Console View --
    await waitForConnected(page);
    await waitForStatus(page, 'Running');
    await waitForTerminal(page);
    await page.waitForTimeout(2000); // Let terminal content settle

    // -- Step 4: Send simple command --
    const input = page.locator(SELECTORS.CONSOLE.inputField);
    await input.fill('What is 2+2? Reply with just the number, nothing else.');
    await page.getByRole('button', { name: 'Send' }).click();

    // Wait for Claude to respond
    await page.waitForTimeout(15_000);

    // -- Step 5: Trigger approval flow --
    await input.fill('Create a file at /tmp/e2e-journey-test.txt containing "journey test"');
    await page.getByRole('button', { name: 'Send' }).click();

    await waitForApprovalCard(page);

    // -- Step 6: Approve --
    await page.getByRole('button', { name: 'Approve' }).click();
    await waitForApprovalDismissed(page);
    await page.waitForTimeout(5000); // Let Claude continue

    // -- Step 7: Simulate disconnect --
    await page.route('**/ws', (route) => route.abort());
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await waitForDisconnected(page, 30_000);

    // -- Step 8: Restore connection --
    await page.unroute('**/ws');
    await waitForConnected(page, 60_000);
    await page.waitForTimeout(2000);
  });
});
