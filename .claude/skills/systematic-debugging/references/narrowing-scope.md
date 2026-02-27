# Narrowing Scope

Systematic techniques for reducing the search space when the root cause is not immediately obvious. Use between Phase 1 (evidence gathering) and Phase 3 (hypothesis testing) to focus investigation.

## Table of Contents

- [Binary Elimination](#binary-elimination)
- [Minimal Reproduction](#minimal-reproduction)
- [Controlled Comparison](#controlled-comparison)
- [Decision Guide](#decision-guide)

## Binary Elimination

Cut the problem space in half with each test. Converges in O(log n) steps.

### Code-level bisection

```
Full system broken
├── Disable half the middleware → still broken?
│   ├── YES → bug is in remaining half, disable half of THAT
│   └── NO → bug was in disabled half, re-enable and bisect that
```

**Practical example (API returning wrong data):**

```python
def get_user_report(user_id):
    user = fetch_user(user_id)           # Step 1: verify user data correct here
    enriched = enrich_with_team(user)     # Step 2: verify enriched data correct here
    formatted = format_report(enriched)   # Step 3: verify formatted data correct here
    return formatted
```

Add a checkpoint log at Step 2. If data is correct at Step 2 but wrong in final output → bug is in `format_report`. If already wrong at Step 2 → bug is in `enrich_with_team`. One check, half the code eliminated.

### Middleware/pipeline bisection

For request pipelines with many stages (auth → validation → transform → persist):

1. Return early at the midpoint with debug output
2. If output is correct at midpoint → problem is downstream
3. If output is wrong at midpoint → problem is upstream
4. Repeat on the remaining half

### Test file bisection

When a test passes alone but fails in suite → test pollution. Use `scripts/find-polluter.sh` or manually:

1. Run first half of test suite + failing test → fails?
2. YES → polluter is in first half, split again
3. NO → polluter is in second half

## Minimal Reproduction

Strip away components until only the bug remains. The fewer moving parts, the clearer the cause.

### Process

```
Start with full broken scenario
  → Remove component A → still broken? Keep it removed.
  → Remove component B → fixed? B is involved. Add it back.
  → Remove component C → still broken? Keep it removed.
  → ...
  → Result: smallest setup that still reproduces the bug
```

### Practical steps

1. **Isolate the test**: Extract the failing scenario into a standalone test with minimal fixtures
2. **Remove dependencies**: Replace real services with stubs one at a time. If bug disappears when stubbing service X → X is involved
3. **Simplify input**: Reduce test data to minimum. Large payload failing? Try with just the required fields
4. **Remove configuration**: Use defaults. If bug disappears with defaults → config-related

### Example

```python
# Full scenario (complex, many dependencies)
def test_user_report_generation():
    team = create_team_with_members(50)
    schedule = generate_monthly_schedule(team)
    report = generate_report(team, schedule, format="pdf", locale="zh-CN")
    assert report.status == "complete"

# Minimal reproduction (isolated the cause: locale handling)
def test_user_report_minimal():
    team = create_team_with_members(1)
    report = generate_report(team, None, format="pdf", locale="zh-CN")
    assert report.status == "complete"  # Fails! locale + None schedule = bug
```

## Controlled Comparison

Run working and broken paths side by side, diff the intermediate state.

### Same code, different inputs

```python
# Working case
logger.info("WORKING input: %s", working_input)
result_good = process(working_input)
logger.info("WORKING output: %s", result_good)

# Broken case
logger.info("BROKEN input: %s", broken_input)
result_bad = process(broken_input)
logger.info("BROKEN output: %s", result_bad)

# Compare: what differs between inputs that causes different outputs?
```

### Same input, different environments

```bash
# Diff environment variables between working and broken
diff <(ssh working-server env | sort) <(ssh broken-server env | sort)

# Diff config files
diff config/working.yaml config/broken.yaml

# Diff database state
diff <(psql -c "SELECT * FROM settings" db_working) \
     <(psql -c "SELECT * FROM settings" db_broken)
```

### Before/after state comparison

```python
# Capture state before operation
state_before = {
    "db_count": db.query(User).count(),
    "cache_keys": redis.keys("user:*"),
    "file_exists": os.path.exists(target_path),
}

# Run the operation
operation()

# Capture state after
state_after = {
    "db_count": db.query(User).count(),
    "cache_keys": redis.keys("user:*"),
    "file_exists": os.path.exists(target_path),
}

# What changed that shouldn't have? What didn't change that should have?
logger.info("State diff: before=%s, after=%s", state_before, state_after)
```

## Decision Guide

| Situation | Best Technique |
|-----------|---------------|
| Bug in large codebase, unsure which module | Binary elimination |
| Complex test scenario, many dependencies | Minimal reproduction |
| Works in env A, fails in env B | Controlled comparison |
| Works for user A, fails for user B | Controlled comparison (diff inputs) |
| Passes alone, fails in test suite | Binary elimination (find-polluter) |
| Intermittent failure | Minimal reproduction + add logging at each layer |
