import { test, expect } from '../fixtures/server-fixture.js';
import { SELECTORS } from '../helpers/selectors.js';
import { waitForConnected, waitForTerminal, waitForStatus } from '../helpers/wait-helpers.js';
import { takeTerminalScreenshot } from '../helpers/screenshot-helper.js';

test.describe('Send Command', () => {
  test.beforeEach(async ({ page, authenticate }) => {
    await authenticate(page);
    await waitForConnected(page);
    await waitForTerminal(page);
  });

  test('send simple question and verify terminal changes', async ({ page }) => {
    // Take "before" screenshot
    await page.waitForTimeout(2000);
    const before = await takeTerminalScreenshot(page);

    // Type and send a simple question
    const input = page.locator(SELECTORS.CONSOLE.inputField);
    await input.fill('What is 2+2? Reply with just the number.');
    await page.getByRole('button', { name: 'Send' }).click();

    // Wait for Claude to process — status may go to Running
    // Wait long enough for response (Claude API can take 10-30s)
    await page.waitForTimeout(15_000);

    // Take "after" screenshot — should be different
    const after = await takeTerminalScreenshot(page);

    // Verify screenshots are different (Claude produced output)
    expect(before.equals(after)).toBe(false);
  });

  test('Enter key sends the command', async ({ page }) => {
    const input = page.locator(SELECTORS.CONSOLE.inputField);
    await input.fill('Say hello');
    await input.press('Enter');

    // Input should be cleared after send
    await expect(input).toHaveValue('');
  });

  test('input field clears after sending', async ({ page }) => {
    const input = page.locator(SELECTORS.CONSOLE.inputField);
    await input.fill('Test message');
    await page.getByRole('button', { name: 'Send' }).click();

    // Input should be empty
    await expect(input).toHaveValue('');
  });
});
