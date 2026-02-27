import { test, expect } from '../fixtures/server-fixture.js';
import { SELECTORS } from '../helpers/selectors.js';
import {
  waitForConnected,
  waitForTerminal,
  waitForApprovalCard,
  waitForApprovalDismissed,
  waitForStatus,
} from '../helpers/wait-helpers.js';

test.describe('Approval Flow', () => {
  test.beforeEach(async ({ page, authenticate }) => {
    await authenticate(page);
    await waitForConnected(page);
    await waitForTerminal(page);
  });

  test('trigger approval and verify card content', async ({ page }) => {
    // Send a command that will trigger tool use requiring approval
    const input = page.locator(SELECTORS.CONSOLE.inputField);
    await input.fill('Create a file called /tmp/e2e-test-approval.txt with content "hello from e2e test"');
    await page.getByRole('button', { name: 'Send' }).click();

    // Wait for approval card to appear (may take a while for Claude to process)
    await waitForApprovalCard(page);

    // Verify card content
    await expect(page.getByText('Approval Required')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible();
  });

  test('approve action dismisses card', async ({ page }) => {
    const input = page.locator(SELECTORS.CONSOLE.inputField);
    await input.fill('Create a file called /tmp/e2e-test-approve.txt with content "approved"');
    await page.getByRole('button', { name: 'Send' }).click();

    await waitForApprovalCard(page);

    // Click Approve
    await page.getByRole('button', { name: 'Approve' }).click();

    // Card should disappear
    await waitForApprovalDismissed(page);

    // Status should return to Running
    await waitForStatus(page, 'Running', 60_000);
  });

  test('reject action dismisses card', async ({ page }) => {
    const input = page.locator(SELECTORS.CONSOLE.inputField);
    await input.fill('Create a file called /tmp/e2e-test-reject.txt with content "rejected"');
    await page.getByRole('button', { name: 'Send' }).click();

    await waitForApprovalCard(page);

    // Click Reject
    await page.getByRole('button', { name: 'Reject' }).click();

    // Card should disappear
    await waitForApprovalDismissed(page);

    // Status should return to Running (Claude handles the rejection)
    await waitForStatus(page, 'Running', 60_000);
  });
});
