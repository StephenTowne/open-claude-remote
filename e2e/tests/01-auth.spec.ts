import { test, expect } from '../fixtures/server-fixture.js';
import { SELECTORS } from '../helpers/selectors.js';
import { expectPageSnapshot } from '../helpers/screenshot-helper.js';

test.describe('Authentication Flow', () => {
  test('shows auth page on first visit', async ({ page, serverUrl }) => {
    await page.goto(serverUrl);

    // Title visible
    await expect(page.locator(SELECTORS.AUTH.title)).toBeVisible();
    // Subtitle visible
    await expect(page.locator(SELECTORS.AUTH.subtitle)).toBeVisible();
    // Token input visible
    await expect(page.locator(SELECTORS.AUTH.tokenInput)).toBeVisible();
    // Connect button visible
    await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible();
  });

  test('connect button is disabled when token is empty', async ({ page, serverUrl }) => {
    await page.goto(serverUrl);

    const button = page.getByRole('button', { name: 'Connect' });
    await expect(button).toBeDisabled();
  });

  test('shows error with invalid token', async ({ page, serverUrl }) => {
    await page.goto(serverUrl);

    // Enter wrong token
    await page.getByLabel('Authentication token').fill('wrong-token-12345');
    await page.getByRole('button', { name: 'Connect' }).click();

    // Wait for error message
    await expect(page.getByText('Invalid token')).toBeVisible({ timeout: 10_000 });
  });

  test('successful auth navigates to console page', async ({ page, serverUrl, authToken }) => {
    await page.goto(serverUrl);

    // Enter correct token
    await page.getByLabel('Authentication token').fill(authToken);
    await page.getByRole('button', { name: 'Connect' }).click();

    // Should navigate to console — StatusBar with "Connected" visible
    await expect(page.getByText('Connected')).toBeVisible({ timeout: 30_000 });
    // StatusBar brand name visible
    await expect(page.getByText('Claude Remote')).toBeVisible();
    // Terminal visible
    await expect(page.locator(SELECTORS.CONSOLE.terminal)).toBeVisible();
    // InputBar visible
    await expect(page.locator(SELECTORS.CONSOLE.inputField)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
  });

  test('auth page screenshot baseline', async ({ page, serverUrl }) => {
    await page.goto(serverUrl);
    // Wait for page to settle
    await expect(page.locator(SELECTORS.AUTH.title)).toBeVisible();
    await expectPageSnapshot(page, 'auth-page');
  });
});
