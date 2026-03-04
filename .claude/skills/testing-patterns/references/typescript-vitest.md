# TypeScript Testing Patterns (Vitest)

Comprehensive reference for testing TypeScript with Vitest, based on real project patterns.

## Quick Start

```typescript
import { describe, it, expect } from 'vitest';

describe('Calculator', () => {
  it('should add two numbers', () => {
    expect(1 + 2).toBe(3);
  });

  it('should handle negative numbers', () => {
    expect(-1 + 1).toBe(0);
  });
});

// Run with: cd backend && pnpm test -- tests/unit/calculator.test.ts
```

## Setup & Teardown

Use `beforeEach`/`afterEach` for per-test setup and cleanup:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(3, 60_000);
  });

  afterEach(() => {
    limiter.destroy(); // Clean up resources
  });

  it('should allow attempts within limit', () => {
    expect(limiter.attempt('1.2.3.4')).toBe(true);
  });
});
```

Use `beforeAll`/`afterAll` for expensive one-time setup (DB connections, servers):

```typescript
import { beforeAll, afterAll } from 'vitest';

let server: Server;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});
```

## Mocking with vi

### vi.fn() — Mock Functions

```typescript
import { vi, expect } from 'vitest';

// Create a mock function
const onApprove = vi.fn();
const onReject = vi.fn();

// Call it
onApprove('test-123');

// Assert calls
expect(onApprove).toHaveBeenCalledOnce();
expect(onApprove).toHaveBeenCalledWith('test-123');
expect(onReject).not.toHaveBeenCalled();
```

### vi.fn() with Callbacks Pattern

```typescript
// Common pattern: mock callback objects
let callbacks: WsHandlerCallbacks;

beforeEach(() => {
  callbacks = {
    onUserInput: vi.fn(),
    onApprovalResponse: vi.fn(),
    onResize: vi.fn(),
  };
});

it('should route messages to correct callback', () => {
  handleWsMessage(ws, JSON.stringify({ type: 'user_input', data: 'hello' }), callbacks);
  expect(callbacks.onUserInput).toHaveBeenCalledWith('hello');
});
```

### vi.spyOn() — Spy on Methods

```typescript
import { vi } from 'vitest';

const spy = vi.spyOn(console, 'log');
doSomething();
expect(spy).toHaveBeenCalledWith('expected message');
spy.mockRestore();
```

### Mock Return Values and Implementations

```typescript
const mockFetch = vi.fn();

// Return a value
mockFetch.mockReturnValue({ ok: true });

// Return a promise
mockFetch.mockResolvedValue({ data: 'result' });

// Return different values per call
mockFetch
  .mockResolvedValueOnce({ data: 'first' })
  .mockResolvedValueOnce({ data: 'second' });

// Custom implementation
mockFetch.mockImplementation((url: string) => {
  if (url.includes('/users')) return { users: [] };
  return { error: 'not found' };
});
```

## Creating Mock Objects

Pattern for mocking complex objects (e.g., WebSocket, Request, Response):

```typescript
// Mock WebSocket
function createMockWs() {
  return {
    readyState: 1, // OPEN
    send: vi.fn(),
  } as any;
}

// Mock Express Request
function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: { cookie: '' },
    ip: '192.168.1.100',
    protocol: 'http',
    body: {},
    ...overrides,
  } as any;
}

// Mock Express Response
function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null,
    status(code: number) { res.statusCode = code; return res; },
    json(data: unknown) { res.body = data; return res; },
    setHeader(key: string, value: string) { res.headers[key] = value; },
  };
  return res;
}
```

## Fake Timers

Control time-dependent behavior:

```typescript
import { vi, expect } from 'vitest';

it('should reset after window expires', () => {
  vi.useFakeTimers();

  limiter.attempt('1.2.3.4');
  limiter.attempt('1.2.3.4');
  limiter.attempt('1.2.3.4');
  expect(limiter.attempt('1.2.3.4')).toBe(false);

  vi.advanceTimersByTime(61_000); // Advance past window
  expect(limiter.attempt('1.2.3.4')).toBe(true);

  vi.useRealTimers(); // ALWAYS restore real timers
});

it('should expire session after TTL', () => {
  vi.useFakeTimers();
  const sessionId = auth.createSession('1.2.3.4');
  expect(auth.validateSession(sessionId)).toBe(true);

  vi.advanceTimersByTime(61_000);
  expect(auth.validateSession(sessionId)).toBe(false);
  vi.useRealTimers();
});
```

**Key APIs**:
- `vi.useFakeTimers()` — start controlling time
- `vi.advanceTimersByTime(ms)` — move time forward
- `vi.runAllTimers()` — execute all pending timers
- `vi.useRealTimers()` — restore (always call in cleanup)

## Testing React Components

Using `@testing-library/react`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

describe('ApprovalCard', () => {
  const mockApproval = {
    id: 'test-123',
    tool: 'Bash',
    description: 'Execute: ls -la /tmp',
    params: { command: 'ls -la /tmp' },
  };

  it('should render tool name and description', () => {
    render(
      <ApprovalCard
        approval={mockApproval}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.getByText('Bash')).toBeDefined();
    expect(screen.getByText('Execute: ls -la /tmp')).toBeDefined();
  });

  it('should call onApprove when button clicked', () => {
    const onApprove = vi.fn();
    render(
      <ApprovalCard
        approval={mockApproval}
        onApprove={onApprove}
        onReject={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Approve'));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it('should conditionally render sections', () => {
    const noParams = { ...mockApproval, params: undefined };
    render(
      <ApprovalCard approval={noParams} onApprove={() => {}} onReject={() => {}} />,
    );
    expect(screen.queryByText('Parameters')).toBeNull();
  });
});
```

**Key APIs**:
- `render(<Component />)` — render component to virtual DOM
- `screen.getByText('...')` — find element (throws if not found)
- `screen.queryByText('...')` — find element (returns null if not found)
- `fireEvent.click(element)` — simulate user click
- `fireEvent.change(input, { target: { value: 'new' } })` — simulate input

## Parameterized Tests

```typescript
// it.each with array of arrays
it.each([
  [2, 3, 5],
  [0, 0, 0],
  [-1, 1, 0],
])('should add %i + %i = %i', (a, b, expected) => {
  expect(add(a, b)).toBe(expected);
});

// it.each with array of objects
it.each([
  { input: 'user@example.com', valid: true },
  { input: 'invalid', valid: false },
  { input: '', valid: false },
])('should validate "$input" as $valid', ({ input, valid }) => {
  expect(isValidEmail(input)).toBe(valid);
});

// describe.each for grouped parameterized tests
describe.each(['sqlite', 'postgres', 'mysql'])('Database: %s', (backend) => {
  it('should connect', () => { /* ... */ });
  it('should query', () => { /* ... */ });
});
```

## Async Testing

```typescript
it('should fetch data', async () => {
  const result = await fetchData('https://api.example.com');
  expect(result.status).toBe(200);
});

it('should reject invalid input', async () => {
  await expect(fetchData('')).rejects.toThrow('Invalid URL');
});

it('should resolve with data', async () => {
  await expect(fetchData('/users')).resolves.toEqual({ users: [] });
});
```

## Module Mocking (vi.mock)

```typescript
import { vi } from 'vitest';

// Mock entire module
vi.mock('../src/services/database.js', () => ({
  query: vi.fn().mockResolvedValue([{ id: 1 }]),
  connect: vi.fn(),
}));

// Mock with factory (hoisted to top of file)
vi.mock('node-pty', () => ({
  spawn: vi.fn(() => ({
    onData: vi.fn(),
    write: vi.fn(),
    kill: vi.fn(),
    pid: 12345,
  })),
}));

// Partial mock — keep real implementations for some exports
vi.mock('../src/utils.js', async () => {
  const actual = await vi.importActual('../src/utils.js');
  return {
    ...actual,
    generateId: vi.fn(() => 'mock-id'),
  };
});
```

**ESM Note**: `vi.mock()` calls are hoisted to the top of the file automatically. Use `vi.importActual()` when you need real implementations alongside mocks.

## Common Assertions

```typescript
// Equality
expect(value).toBe(3);              // Strict equality (===)
expect(obj).toEqual({ a: 1 });      // Deep equality
expect(value).not.toBe(4);          // Negation

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeLessThanOrEqual(10);
expect(0.1 + 0.2).toBeCloseTo(0.3);

// Strings
expect(str).toMatch(/^[0-9a-f]{64}$/);
expect(str).toContain('substring');

// Arrays/Objects
expect(arr).toContain(item);
expect(arr).toHaveLength(3);
expect(obj).toHaveProperty('key', 'value');

// Errors
expect(() => fn()).toThrow();
expect(() => fn()).toThrow('message');
expect(() => fn()).toThrow(TypeError);

// Mock assertions
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledOnce();
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
expect(mockFn).toHaveBeenCalledTimes(3);
expect(mockFn).not.toHaveBeenCalled();

// Accessing mock call data
const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
expect(sent.type).toBe('heartbeat');
```

## Configuration

### Backend (Node environment)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

### Frontend (jsdom environment)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
```

### Running Tests

```bash
# Single test file (preferred — per CLAUDE.md rules)
cd backend && pnpm test -- tests/unit/auth/rate-limiter.test.ts
cd frontend && pnpm test -- tests/components/ApprovalCard.test.tsx

# Pattern matching
cd backend && pnpm test -- tests/unit/auth/

# Full suite (only for final validation)
pnpm test
```

## Resources

- **Vitest docs**: https://vitest.dev/
- **Testing Library**: https://testing-library.com/docs/react-testing-library/intro
- **vi API**: https://vitest.dev/api/vi.html
