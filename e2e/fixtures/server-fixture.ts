import { test as base, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SELECTORS } from '../helpers/selectors.js';

const STATE_FILE = resolve(import.meta.dirname, '../.server-state.json');

interface ServerState {
  pid: number;
  url: string;
  token: string;
}

function loadState(): ServerState {
  if (!existsSync(STATE_FILE)) {
    throw new Error('Server state file not found. Did global-setup run?');
  }
  return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
}

export interface ServerFixture {
  serverUrl: string;
  authToken: string;
  authenticate: (page: Page) => Promise<void>;
}

export const test = base.extend<ServerFixture>({
  serverUrl: async ({}, use) => {
    const state = loadState();
    await use(state.url);
  },

  authToken: async ({}, use) => {
    const state = loadState();
    await use(state.token);
  },

  authenticate: async ({}, use) => {
    const state = loadState();
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
              } catch { /* ignore non-JSON */ }
            });
          }
        };
      });
      await page.goto(state.url);
      // Fill token input
      await page.getByLabel('Authentication token').fill(state.token);
      // Click Connect button
      await page.getByRole('button', { name: 'Connect' }).click();
      // Wait for console page to load — StatusBar visible with "Connected"
      await page.getByText('Connected').waitFor({ state: 'visible', timeout: 30_000 });
    };
    await use(fn);
  },
});

export { expect } from '@playwright/test';
