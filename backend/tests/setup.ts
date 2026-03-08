/**
 * Global test setup for backend tests.
 * Installs a fetch guard that prevents any test from accidentally
 * hitting the real daemon running on localhost:8866.
 */
import { beforeAll, afterEach } from 'vitest';

const DAEMON_PORT = '8866';
const BLOCKED_HOSTS = [`localhost:${DAEMON_PORT}`, `127.0.0.1:${DAEMON_PORT}`];

const originalFetch = globalThis.fetch;

function guardedFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  for (const host of BLOCKED_HOSTS) {
    if (url.includes(host)) {
      throw new Error(
        `[test-safety-net] Blocked fetch to real daemon at ${host}. ` +
          `Tests must mock fetch or use a random port. URL: ${url}`,
      );
    }
  }

  return originalFetch(input, init);
}

beforeAll(() => {
  globalThis.fetch = guardedFetch as typeof fetch;
});

afterEach(() => {
  // Restore the guard after each test, in case a test replaced
  // globalThis.fetch with its own mock and didn't clean up.
  globalThis.fetch = guardedFetch as typeof fetch;
});
