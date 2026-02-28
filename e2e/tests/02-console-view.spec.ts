import { test, expect } from '../fixtures/server-fixture.js';
import { SELECTORS } from '../helpers/selectors.js';
import { waitForConnected, waitForStatus, waitForTerminal } from '../helpers/wait-helpers.js';
import { serverManager } from '../helpers/server-manager.js';

test.describe('Console View', () => {
  test.beforeAll(async () => {
    await serverManager.start();
  });
  test.afterAll(async () => {
    await serverManager.stop();
  });

  test.beforeEach(async ({ page, authenticate }) => {
    await authenticate(page);
  });

  test('StatusBar shows Running and Connected', async ({ page }) => {
    await waitForConnected(page);
    await waitForStatus(page, 'Running');

    await expect(page.getByText('Running', { exact: true })).toBeVisible();
    await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  });

  test('terminal canvas is rendered (non-blank)', async ({ page }) => {
    await waitForTerminal(page);

    // xterm.js canvas should exist inside the terminal container
    const canvas = page.locator(`${SELECTORS.CONSOLE.terminal} canvas`);
    await expect(canvas.first()).toBeVisible();
  });

  test('InputBar is visible and usable', async ({ page }) => {
    const input = page.locator(SELECTORS.CONSOLE.inputField);
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();

    const sendButton = page.getByRole('button', { name: 'Send' });
    await expect(sendButton).toBeVisible();
  });
});
