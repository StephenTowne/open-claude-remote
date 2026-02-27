---
name: systematic-debugging
description: >
  Systematic root-cause debugging methodology with 5-phase process
  (Classify, Investigate, Narrow Scope, Hypothesis Test, Fix & Verify).
  Use when encountering any bug, test failure, unexpected behavior,
  build error, performance issue, flaky test, or concurrency problem.
  Use when user says "debug this", "why is this failing", "fix this bug",
  "test failure", "not working", "investigate error", "find root cause",
  "flaky test", "performance issue", or "race condition".
  Do NOT use for feature implementation, code review, or refactoring.
---

# Systematic Debugging

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

Random fixes waste time and create new bugs. ALWAYS find root cause before attempting fixes.

## Phase 0: Classify the Problem

**Before investigating, identify the problem type to choose the right strategy:**

| Type | Signals | Primary Strategy |
|------|---------|-----------------|
| **Deterministic bug** | Fails every time, same input → same error | Reproduce → breakpoint/trace → fix |
| **Intermittent/flaky** | Passes sometimes, fails under load or in CI | Add logging at boundaries → collect across runs → find pattern |
| **Performance** | Slow response, timeout, high resource usage | Profile → identify hotspot → benchmark before/after |
| **Concurrency/race** | Fails only under parallel execution, data corruption | Minimize concurrency → add locking analysis → construct race condition |
| **Environment-specific** | Works locally, fails in CI/staging/production | Controlled comparison of env vars, configs, dependencies |

**Quick decision:**
- Can reproduce reliably? → Phase 1 directly
- Cannot reproduce? → Add diagnostic logging first, then wait for occurrence
- Performance issue? → See `references/debugging-toolkit.md` [Profiling] section before Phase 1

## Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read Error Messages Carefully**
   - Read stack traces completely — note line numbers, file paths, error codes
   - Don't skip warnings — they often contain the exact solution

2. **Reproduce Consistently**
   - Can you trigger it reliably? What are the exact steps?
   - If not reproducible → gather more data, don't guess

3. **Check Recent Changes**
   - `git diff`, `git log` — what changed recently?
   - Use `git bisect` for systematic identification: see `references/debugging-toolkit.md` [Git Bisect]
   - New dependencies, config changes, environmental differences?

4. **Gather Evidence in Multi-Component Systems**

   For systems with multiple layers (API → service → database):

   ```
   For EACH component boundary:
     - Log what data enters / exits the component
     - Verify environment/config propagation
   Run once → analyze evidence → identify failing component
   ```

5. **Trace Data Flow**

   When error is deep in call stack, see `references/root-cause-tracing.md` for the complete backward tracing technique.

   Quick version: Where does bad value originate? → What called this? → Keep tracing up → Fix at source.

**Tool selection:** See `references/debugging-toolkit.md` for concrete tools (log analysis, breakpoint debugging, DB inspection, network inspection, git bisect, profiling).

## Phase 2: Narrow the Scope

**Systematically reduce the search space before forming hypotheses.**

Use these techniques from `references/narrowing-scope.md`:

- **Binary elimination** — Disable half the code/middleware, check if bug persists. Repeat on remaining half. O(log n) convergence.
- **Minimal reproduction** — Strip components until only the bug remains. Fewer parts = clearer cause.
- **Controlled comparison** — Run working vs broken side by side, diff intermediate state.

| Situation | Best Technique |
|-----------|---------------|
| Unsure which module | Binary elimination |
| Complex test, many dependencies | Minimal reproduction |
| Works in env A, fails in env B | Controlled comparison |
| Passes alone, fails in suite | Test pollution → `scripts/find-polluter.sh` |

**Exit criteria:** You can point to a specific module/function/config as the suspect.

## Phase 3: Hypothesis and Testing

**Scientific method:**

1. **Form Single Hypothesis**
   - State clearly: "I think X is the root cause because Y"
   - Be specific, not vague

2. **Test Minimally**
   - Make the SMALLEST possible change to test hypothesis
   - One variable at a time — don't fix multiple things at once

3. **Verify**
   - Confirmed? → Phase 4
   - Refuted? → Form NEW hypothesis. DON'T add more fixes on top

4. **When You Don't Know**
   - Say "I don't understand X" — don't pretend to know
   - See [When You're Stuck](#when-youre-stuck) below

## Phase 4: Fix and Verify

**Fix the root cause, not the symptom:**

1. **Create Failing Test Case**
   - Simplest possible automated reproduction — MUST have before fixing
   - Use the `python-testing-patterns` skill for writing proper failing tests

2. **Implement Single Fix**
   - Address the root cause identified — ONE change at a time
   - No "while I'm here" improvements, no bundled refactoring

3. **Verify Fix Thoroughly**
   - Failing test now passes?
   - No other tests broken?
   - **Root cause confirmation:** Re-inject original error condition → verify defense layer catches it
   - **Boundary conditions:** null/empty values, concurrent access, large data volumes
   - **Regression check:** Could the fix introduce variants of the same bug elsewhere?
   - See `references/defense-in-depth.md` for adding validation at multiple layers

4. **If Fix Doesn't Work**
   - STOP. Count: how many fixes have you tried?
   - If < 3: Return to Phase 1 with new information
   - **If ≥ 3: STOP — see [3+ Fixes Failed](#3-fixes-failed) below**

## When You're Stuck

**Graduated escalation before questioning architecture:**

1. **Rubber duck** — Explain the full problem out loud (to user or in writing). Articulating often reveals gaps in understanding
2. **Invert perspective** — Stop asking "why is it broken?" Ask "why does it work in case X?" and trace what's different
3. **Reset context** — Summarize everything known so far in a clean list. Discard assumptions accumulated during investigation
4. **Ask for help** — Describe to user: (a) what you've investigated, (b) what you've ruled out, (c) what you don't understand. This lets them help efficiently

### 3+ Fixes Failed

Pattern indicating architectural problem:
- Each fix reveals new shared state/coupling in a different place
- Fixes require "massive refactoring" to implement
- Each fix creates new symptoms elsewhere

**STOP and question fundamentals:**
- Is this pattern fundamentally sound?
- Should we refactor architecture vs. continue fixing symptoms?
- **Discuss with user before attempting more fixes**

## Red Flags — STOP and Return to Phase 1

If you catch yourself thinking:
- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "It's probably X, let me fix that"
- "I don't fully understand but this might work"
- "Here are the main problems: [lists fixes without investigation]"
- "One more fix attempt" (when already tried 2+)
- Proposing solutions before tracing data flow

**ALL of these mean: STOP. You are skipping the process.**

## User Signals You're Doing It Wrong

- "Is that not happening?" — You assumed without verifying
- "Will it show us...?" — You should have added evidence gathering
- "Stop guessing" — You're proposing fixes without understanding
- "We're stuck?" (frustrated) — Your approach isn't working

**When you see these:** STOP. Return to Phase 1.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Issue is simple, don't need process" | Simple issues have root causes too. Process is fast for simple bugs. |
| "Emergency, no time for process" | Systematic debugging is FASTER than guess-and-check thrashing. |
| "Just try this first, then investigate" | First fix sets the pattern. Do it right from the start. |
| "I'll write test after confirming fix works" | Untested fixes don't stick. Test first proves it. |
| "Multiple fixes at once saves time" | Can't isolate what worked. Causes new bugs. |
| "I see the problem, let me fix it" | Seeing symptoms ≠ understanding root cause. |
| "One more fix attempt" (after 2+ failures) | 3+ failures = architectural problem, not hypothesis problem. |

## Quick Reference

| Phase | Key Activities | Exit Criteria |
|-------|---------------|---------------|
| **0. Classify** | Identify problem type | Strategy selected |
| **1. Investigate** | Read errors, reproduce, check changes, gather evidence | Understand WHAT and WHERE |
| **2. Narrow** | Binary elimination, minimal reproduction, controlled comparison | Suspect module/function identified |
| **3. Hypothesis** | Form theory, test minimally, one variable at a time | Root cause confirmed |
| **4. Fix & Verify** | Create test, fix, verify thoroughly, check boundaries | Bug resolved, tests pass, defenses added |

## Supporting Techniques

Available in the `references/` directory — loaded as needed:

| Reference | When to Read |
|-----------|-------------|
| `references/debugging-toolkit.md` | Need concrete tool for log analysis, breakpoints, DB inspection, network, git bisect, or profiling |
| `references/narrowing-scope.md` | Need to systematically reduce search space (Phase 2) |
| `references/root-cause-tracing.md` | Bug is deep in call stack, need to trace backward to origin |
| `references/defense-in-depth.md` | After fixing, need to add multi-layer validation to prevent recurrence |
| `references/condition-based-waiting.md` | Dealing with flaky tests caused by arbitrary timeouts/sleeps |

**Related skills:**
- **python-testing-patterns** — For creating failing test cases (Phase 4, Step 1)
