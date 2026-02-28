import { test as base, type Page } from '@playwright/test';
import { serverManager } from '../helpers/server-manager.js';
import { SELECTORS } from '../helpers/selectors.js';

export interface ServerFixture {
  serverUrl: string;
  authToken: string;
  authenticate: (page: Page) => Promise<void>;
}

export const test = base.extend<ServerFixture>({
  serverUrl: async ({}, use) => {
    await use(serverManager.url);
  },

  authToken: async ({}, use) => {
    await use(serverManager.token);
  },

  authenticate: async ({}, use) => {
    const fn = async (page: Page) => {
      // Inject WS seq tracker before navigation — persists across page loads
      await page.addInitScript(() => {
        (window as unknown as Record<string, number>).__wsSeq = 0;
        const OrigWS = window.WebSocket;
        window.WebSocket = class extends OrigWS {
          constructor(...args: ConstructorParameters<typeof OrigWS>) {
            super(...args);
            this.addEventListener('message', (e: MessageEvent) => {
              try {
                const msg = JSON.parse(e.data as string) as { seq?: number };
                const w = window as unknown as Record<string, number>;
                if (typeof msg.seq === 'number' && msg.seq > (w.__wsSeq ?? 0)) {
                  w.__wsSeq = msg.seq;
                }
              } catch {
                /* ignore non-JSON */
              }
            });
          }
        };
      });
      await page.goto(serverManager.url);
      // Fill token input
      await page.getByLabel('Authentication token').fill(serverManager.token);
      // Click Connect button
      await page.getByRole('button', { name: 'Connect' }).click();
      // Wait for console page to load — StatusBar visible with "Connected"
      await page.getByText('Connected').waitFor({ state: 'visible', timeout: 30_000 });
    };
    await use(fn);
  },
});

export { expect } from '@playwright/test';
