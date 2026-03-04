# Debugging Toolkit

Concrete tools and techniques for gathering evidence during investigation. Select tools based on problem type.

## Table of Contents

- [Log Analysis](#log-analysis)
- [Breakpoint Debugging](#breakpoint-debugging)
- [Database State Inspection](#database-state-inspection)
- [Network Request Inspection](#network-request-inspection)
- [Git Bisect](#git-bisect)
- [Profiling](#profiling)

## Log Analysis

### Search patterns

```bash
# Search with context (5 lines before/after match)
grep -C 5 "ERROR" logs/error.log

# Follow log in real-time filtered by keyword
tail -f logs/app.log | grep "user_id=123"

# Search across time range (combine with timestamp pattern)
grep "2026-02-25 14:3" logs/app.log

# Count error frequency by type
grep "ERROR" logs/error.log | awk '{print $NF}' | sort | uniq -c | sort -rn
```

### Add targeted logging

When existing logs are insufficient, add diagnostic logging at component boundaries:

```python
import logging
logger = logging.getLogger(__name__)

# Before suspicious operation
logger.info("Operation input: user_id=%s, payload=%s", user_id, payload)
result = suspicious_operation(user_id, payload)
logger.info("Operation output: result=%s", result)
```

**Key:** Log INPUTS and OUTPUTS at each layer boundary. Run once, analyze, remove.

## Breakpoint Debugging

### Python (pdb)

```python
# Insert breakpoint at suspicious location
breakpoint()  # Python 3.7+

# Or with more control
import pdb; pdb.set_trace()
```

**Useful pdb commands:**
- `n` — next line
- `s` — step into function
- `c` — continue to next breakpoint
- `p expr` — print expression
- `pp obj` — pretty-print object
- `w` — show call stack
- `u/d` — move up/down call stack
- `l` — show source around current line

### Conditional breakpoints

```python
# Break only when condition is met
if user_id == "problematic_user":
    breakpoint()
```

### pytest with debugger

```bash
# Drop into debugger on test failure
uv run pytest tests/test_target.py -x --pdb

# Drop into debugger at first line of test
uv run pytest tests/test_target.py -x --trace
```

## Database State Inspection

When bugs involve data inconsistency, query DB directly instead of relying on code logic:

```sql
-- Check actual state vs expected state
SELECT id, status, updated_at FROM orders WHERE user_id = 'xxx';

-- Find data anomalies
SELECT status, COUNT(*) FROM orders GROUP BY status;

-- Check for concurrent modification (timestamps close together)
SELECT * FROM audit_log
WHERE table_name = 'orders' AND record_id = 'xxx'
ORDER BY created_at DESC LIMIT 20;
```

**Pattern:** Hypothesize what data should look like → query actual state → identify discrepancy.

## Network Request Inspection

### Reproduce API calls

```bash
# Extract request from browser/logs, replay with curl
curl -X POST http://localhost:8000/api/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "test"}' \
  -v  # verbose: show request/response headers

# Compare responses between working and broken
diff <(curl -s url1 | jq .) <(curl -s url2 | jq .)
```

### Check response timing

```bash
# Measure response time
curl -o /dev/null -s -w "time_total: %{time_total}s\n" http://localhost:8000/api/health
```

## Git Bisect

Systematically find the commit that introduced a bug using binary search:

```bash
# Start bisect
git bisect start

# Mark current state as bad
git bisect bad

# Mark a known good commit
git bisect good <commit-hash-or-tag>

# Git checks out midpoint. Test and mark:
git bisect good  # if this commit works
git bisect bad   # if this commit is broken

# Repeat until Git identifies the first bad commit
# When done:
git bisect reset
```

### Automated bisect with test command

```bash
# Automatically run a test at each step
git bisect start HEAD v1.0.0
git bisect run uv run pytest tests/test_specific.py -x

# For frontend
git bisect run pnpm test -- --testPathPattern="specific.test"
```

**When to use:** Bug existed before but unsure which commit introduced it. More efficient than manual log review for large commit histories.

## Profiling

### Python CPU profiling

```python
import cProfile
import pstats

# Profile a function call
profiler = cProfile.Profile()
profiler.enable()
result = slow_function()
profiler.disable()

# Print top 20 slowest calls
stats = pstats.Stats(profiler)
stats.sort_stats('cumulative')
stats.print_stats(20)
```

### Quick timing

```python
import time

start = time.perf_counter()
result = operation()
elapsed = time.perf_counter() - start
logger.info("operation took %.3fs", elapsed)
```

### SQL query analysis

```sql
-- Check query execution plan
EXPLAIN ANALYZE SELECT * FROM users WHERE team_id = 'xxx';

-- Find slow queries (PostgreSQL)
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;
```
