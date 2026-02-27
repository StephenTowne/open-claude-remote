---
name: testing-patterns
description: >
  Language-agnostic testing methodology covering TDD, test structure (AAA),
  isolation, boundary testing, mocking, parameterized tests, and quality
  checklists. Use when writing tests, setting up test suites, reviewing test
  quality, or implementing TDD in any language. Supports Python/pytest and
  TypeScript/Vitest via dedicated references. Triggers: "write tests",
  "test this", "add tests", "TDD", "testing strategy", "test coverage",
  "unit test", "integration test", "mock", "fixture", "vitest", "pytest".
---

# Testing Patterns

Universal testing methodology with language-specific references for Python/pytest and TypeScript/Vitest.

## Language Detection & Reference Routing

Before writing tests, detect the project's language and testing framework:

1. **Check project files** in this priority order:
   - `vitest.config.ts` / `vitest.config.js` → Load [references/typescript-vitest.md](references/typescript-vitest.md)
   - `jest.config.*` / `package.json` with jest config → Load [references/typescript-vitest.md](references/typescript-vitest.md) (adapt patterns)
   - `pytest.ini` / `pyproject.toml` with `[tool.pytest]` / `conftest.py` → Load [references/python-pytest.md](references/python-pytest.md)
   - `*.test.ts` / `*.test.tsx` / `*.spec.ts` files → TypeScript/Vitest
   - `test_*.py` / `*_test.py` files → Python/pytest

2. **If both exist** (polyglot repo): load the reference matching the file being tested.

3. **For advanced topics** (property-based testing, CI/CD, async patterns, time mocking): load [references/advanced-patterns.md](references/advanced-patterns.md).

## Core Concepts

### Test Types

- **Unit Tests**: Test individual functions/classes in isolation. Fast, no external dependencies.
- **Integration Tests**: Test interaction between components (e.g., API + database).
- **Functional/E2E Tests**: Test complete features from the user's perspective.
- **Performance Tests**: Measure speed, resource usage, and scalability.

### Test Structure (AAA Pattern)

Every test follows three phases:

```
Arrange  →  Set up test data, mocks, and preconditions
Act      →  Execute the code under test (single action)
Assert   →  Verify the results match expectations
```

### Test Coverage

- Measure what code is exercised by tests.
- Aim for meaningful coverage on critical paths, not just high percentages.
- Untested error paths and edge cases are more dangerous than a low coverage number.

### Test Isolation

- Tests MUST be independent — no shared mutable state between tests.
- Each test sets up its own data and cleans up after itself.
- Test execution order must not matter.

## Test Design Principles

### One Behavior Per Test

Each test verifies exactly one behavior. This makes failures easy to diagnose.

```
BAD:  test_user_service()       → creates, updates, and deletes in one test
GOOD: test_create_user_assigns_id()     → one behavior
GOOD: test_update_user_changes_name()   → one behavior
```

### Test Error Paths

Always test failure cases, not just happy paths:

- Invalid input → correct error type and message
- Missing data → graceful handling or clear error
- Boundary conditions → empty, zero, max, overflow
- External failures → timeout, network error, permission denied

### Boundary Case Checklist

For any function, test these boundaries:

| Category | Test Cases |
|----------|-----------|
| Empty/Zero | `""`, `[]`, `0`, `null`, `undefined`/`None` |
| Single | One element, one character, value of 1 |
| Boundaries | Min value, max value, just inside/outside limits |
| Negative | Negative numbers, reversed ranges |
| Duplicates | Repeated values, duplicate keys |
| Special chars | Unicode, whitespace, escape sequences |
| Type errors | Wrong type input (if dynamically typed) |

### Test Independence

Tests MUST NOT depend on execution order or shared state:

```
BAD:  test_create() creates data → test_delete() assumes it exists
GOOD: test_delete() creates its own data, then deletes it
BEST: Use setup/teardown (fixtures/beforeEach) for isolated test data
```

## Test Naming Conventions

### Python (pytest)

```
test_<unit>_<scenario>_<expected_outcome>

test_create_user_with_valid_data_returns_user
test_divide_by_zero_raises_error
test_login_with_expired_token_returns_401
```

### TypeScript (Vitest/Jest)

```
describe('<Unit>', () => {
  it('should <expected behavior> when <scenario>')
})

describe('RateLimiter', () => {
  it('should block attempts exceeding limit')
  it('should reset after window expires')
})
```

### Universal Rules

- Name describes the **what** and **when**, not the **how**
- A failing test's name alone should tell you what broke
- Avoid `test1`, `testFunction`, `testUser` — too vague

## Testing Workflow (TDD)

### Red-Green-Refactor Cycle

```
1. RED    — Write a failing test for the desired behavior
2. GREEN  — Write minimum code to make the test pass
3. REFACTOR — Clean up code while keeping tests green
```

### Practical TDD Steps

1. **Before coding**: grep/read the target module's API to understand signatures
2. **Write one test**: for the simplest expected behavior
3. **Run that single test file**: not the entire suite
   - Python: `pytest tests/test_specific.py`
   - TypeScript: `cd backend && pnpm test -- tests/unit/specific.test.ts`
4. **See it fail** (confirms the test is valid)
5. **Implement** just enough to pass
6. **Run the test again** — it should pass
7. **Add the next test** for the next behavior
8. **Repeat** until all behaviors are covered

### Mock External Dependencies

- HTTP calls → mock the client/fetch
- Database → mock the connection or use in-memory DB
- File system → use temp directories
- Time → use fake timers
- Random → seed or mock the generator

## Test Quality Checklist

### Completeness (测试完整性)

- [ ] Are there unit tests for all public functions?
- [ ] Are primary features tested?
- [ ] Are boundary cases tested? (empty, zero, max, null)
- [ ] Are error paths tested? (exceptions, invalid input)

### Quality (测试质量)

- [ ] Are tests independent? (no inter-test dependencies)
- [ ] Are tests repeatable? (consistent results on re-run)
- [ ] Are tests clear? (naming and intent are obvious)
- [ ] Are tests fast? (no unnecessary waits or sleeps)

### Coverage (测试覆盖率)

- [ ] Does code coverage meet threshold? (>= 80%)
- [ ] Are critical paths covered?
- [ ] Are edge cases covered?

### Test Case Table (每个功能点必须验证)

| Scenario | Check |
|----------|-------|
| Happy path | Does the main feature work correctly? |
| Boundary values | Min, max, 0, empty string, empty list |
| Null handling | None/null/undefined, missing fields |
| Type errors | Wrong type input |
| Exceptions | Network error, DB error, timeout |
| Concurrency | Multi-thread/multi-process access |
| Large data | Performance boundary testing |
| Unauthorized | Access without proper permissions |
| Idempotency | Duplicate submissions produce same result |

## Reference Directory

Load these references as needed — do NOT preload:

| Reference | When to Load |
|-----------|-------------|
| [python-pytest.md](references/python-pytest.md) | Writing Python tests, using pytest fixtures/markers/mocking |
| [typescript-vitest.md](references/typescript-vitest.md) | Writing TypeScript tests, using vi.fn/vi.mock/fake timers |
| [advanced-patterns.md](references/advanced-patterns.md) | Async testing, property-based testing, CI/CD, time mocking, coverage |
