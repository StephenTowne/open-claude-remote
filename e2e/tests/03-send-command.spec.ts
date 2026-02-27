import { test, expect } from '../fixtures/server-fixture.js';
import { SELECTORS } from '../helpers/selectors.js';
import { waitForConnected, waitForTerminal, waitForTerminalContent, getTerminalSeq, waitForTerminalUpdate } from '../helpers/wait-helpers.js';
import { takeTerminalScreenshot } from '../helpers/screenshot-helper.js';

test.describe('Send Command', () => {
  test.beforeEach(async ({ page, authenticate }) => {
    await authenticate(page);
    await waitForConnected(page);
    await waitForTerminal(page);
  });

  test('send simple question and verify terminal changes', async ({ page }) => {
    // Wait for terminal to have content, then snapshot seq before sending
    await waitForTerminalContent(page);
    const seqBefore = await getTerminalSeq(page);
    const before = await takeTerminalScreenshot(page);

    // Type and send a simple question
    const input = page.locator(SELECTORS.CONSOLE.inputField);
    await input.fill('What is 2+2? Reply with just the number.');
    await page.getByRole('button', { name: 'Send' }).click();

    // Wait until Claude Code produces at least one new terminal_output
    await waitForTerminalUpdate(page, seqBefore);

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
