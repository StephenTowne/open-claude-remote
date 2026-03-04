# Advanced Testing Patterns (Cross-Language)

Advanced testing patterns with examples in both Python/pytest and TypeScript/Vitest.

## Async Testing

### Python (pytest-asyncio)

```python
import pytest
import asyncio

@pytest.mark.asyncio
async def test_fetch_data():
    result = await fetch_data("https://api.example.com")
    assert result["url"] == "https://api.example.com"

@pytest.mark.asyncio
async def test_concurrent_fetches():
    urls = ["url1", "url2", "url3"]
    results = await asyncio.gather(*[fetch_data(url) for url in urls])
    assert len(results) == 3

@pytest.fixture
async def async_client():
    client = await create_client()
    yield client
    await client.close()
```

### TypeScript (Vitest)

```typescript
it('should fetch data', async () => {
  const result = await fetchData('https://api.example.com');
  expect(result.status).toBe(200);
});

it('should reject on error', async () => {
  await expect(fetchData('')).rejects.toThrow('Invalid URL');
});

it('should handle concurrent operations', async () => {
  const results = await Promise.all([
    fetchData('/a'),
    fetchData('/b'),
    fetchData('/c'),
  ]);
  expect(results).toHaveLength(3);
});
```

## Property-Based Testing

Generate random test inputs to discover edge cases your manual tests miss.

### Python (Hypothesis)

```python
from hypothesis import given, strategies as st

@given(st.text())
def test_reverse_twice_is_original(s):
    assert reverse_string(reverse_string(s)) == s

@given(st.integers(), st.integers())
def test_addition_commutative(a, b):
    assert a + b == b + a

@given(st.lists(st.integers()))
def test_sorted_is_ordered(lst):
    sorted_lst = sorted(lst)
    assert len(sorted_lst) == len(lst)
    for i in range(len(sorted_lst) - 1):
        assert sorted_lst[i] <= sorted_lst[i + 1]
```

### TypeScript (fast-check)

```typescript
import fc from 'fast-check';

it('reverse twice is original', () => {
  fc.assert(
    fc.property(fc.string(), (s) => {
      expect(reverse(reverse(s))).toBe(s);
    })
  );
});

it('addition is commutative', () => {
  fc.assert(
    fc.property(fc.integer(), fc.integer(), (a, b) => {
      expect(a + b).toBe(b + a);
    })
  );
});

it('sorted array is ordered', () => {
  fc.assert(
    fc.property(fc.array(fc.integer()), (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i]).toBeLessThanOrEqual(sorted[i + 1]);
      }
    })
  );
});
```

## Retry Behavior Testing

Verify retry logic with sequential mock responses.

### Python

```python
from unittest.mock import Mock

def test_retries_on_transient_error():
    client = Mock()
    client.request.side_effect = [
        ConnectionError("Failed"),
        ConnectionError("Failed"),
        {"status": "ok"},
    ]
    service = ServiceWithRetry(client, max_retries=3)
    result = service.fetch()
    assert result == {"status": "ok"}
    assert client.request.call_count == 3

def test_gives_up_after_max_retries():
    client = Mock()
    client.request.side_effect = ConnectionError("Failed")
    service = ServiceWithRetry(client, max_retries=3)
    with pytest.raises(ConnectionError):
        service.fetch()
    assert client.request.call_count == 3
```

### TypeScript

```typescript
it('should retry on transient error', async () => {
  const mockFetch = vi.fn()
    .mockRejectedValueOnce(new Error('Connection failed'))
    .mockRejectedValueOnce(new Error('Connection failed'))
    .mockResolvedValueOnce({ status: 'ok' });

  const service = new ServiceWithRetry(mockFetch, { maxRetries: 3 });
  const result = await service.fetch();

  expect(result).toEqual({ status: 'ok' });
  expect(mockFetch).toHaveBeenCalledTimes(3);
});

it('should give up after max retries', async () => {
  const mockFetch = vi.fn().mockRejectedValue(new Error('Failed'));
  const service = new ServiceWithRetry(mockFetch, { maxRetries: 3 });

  await expect(service.fetch()).rejects.toThrow('Failed');
  expect(mockFetch).toHaveBeenCalledTimes(3);
});
```

## Time Mocking

### Python (freezegun)

```python
from freezegun import freeze_time
from datetime import datetime

@freeze_time("2026-01-15 10:00:00")
def test_token_expiry():
    token = create_token(expires_in_seconds=3600)
    assert token.expires_at == datetime(2026, 1, 15, 11, 0, 0)

def test_with_time_travel():
    with freeze_time("2026-01-01") as frozen_time:
        item = create_item()
        assert item.created_at == datetime(2026, 1, 1)
        frozen_time.move_to("2026-01-15")
        assert item.age_days == 14
```

### TypeScript (vi.useFakeTimers)

```typescript
it('should expire after TTL', () => {
  vi.useFakeTimers();

  const session = auth.createSession('1.2.3.4');
  expect(auth.validateSession(session)).toBe(true);

  vi.advanceTimersByTime(61_000); // past TTL
  expect(auth.validateSession(session)).toBe(false);

  vi.useRealTimers(); // always restore
});

// Set specific date
it('should use current date', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-15T10:00:00'));

  expect(new Date().toISOString()).toContain('2026-01-15');

  vi.useRealTimers();
});
```

## CI/CD Integration

### Multi-Language GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test-python:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.10", "3.11", "3.12"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
      - run: pip install -e ".[dev]"
      - run: pytest --cov=myapp --cov-report=xml

  test-typescript:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test
```

## Coverage Reporting

### Python (pytest-cov)

```bash
pytest --cov=myapp tests/                          # Terminal report
pytest --cov=myapp --cov-report=html tests/        # HTML report
pytest --cov=myapp --cov-fail-under=80 tests/      # Fail below threshold
pytest --cov=myapp --cov-report=term-missing tests/ # Show missing lines
```

### TypeScript (Vitest)

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',          // or 'istanbul'
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/index.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
```

```bash
cd backend && pnpm test -- --coverage                # Run with coverage
cd backend && pnpm test -- --coverage tests/unit/     # Coverage for subset
```

## Testing Event Emitters

Common pattern in Node.js for testing EventEmitter-based classes:

```typescript
it('should emit approval event on hook', () => {
  const receiver = new HookReceiver();
  const handler = vi.fn();
  receiver.on('approval', handler);

  const approval = receiver.processHook({
    message: 'Claude wants to run: ls -la',
    tool_name: 'Bash',
    tool_input: { command: 'ls -la' },
  });

  expect(handler).toHaveBeenCalledWith(approval);
  expect(approval!.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
});
```

## Testing Data Structures with Boundary Conditions

```typescript
describe('OutputBuffer', () => {
  it('should start empty', () => {
    const buffer = new OutputBuffer(100);
    expect(buffer.getFullContent()).toBe('');
  });

  it('should enforce max lines by dropping oldest', () => {
    const buffer = new OutputBuffer(3);
    buffer.append('line1\nline2\nline3\nline4\nline5\n');
    const content = buffer.getFullContent();
    expect(content).not.toContain('line1');
    expect(content).toContain('line5');
  });

  it('should preserve special characters (ANSI)', () => {
    const buffer = new OutputBuffer(100);
    const ansi = '\x1b[31mred text\x1b[0m';
    buffer.append(ansi);
    expect(buffer.getFullContent()).toBe(ansi);
  });

  it('should handle rapid sequential operations', () => {
    const buffer = new OutputBuffer(100);
    for (let i = 0; i < 50; i++) {
      buffer.append(`chunk${i}`);
    }
    expect(buffer.sequenceNumber).toBe(50);
  });
});
```

## Resources

- **fast-check** (TS property testing): https://fast-check.dev/
- **Hypothesis** (Python property testing): https://hypothesis.readthedocs.io/
- **freezegun** (Python time mocking): https://github.com/spulec/freezegun
- **Vitest fake timers**: https://vitest.dev/api/vi.html#vi-usefaketimers
