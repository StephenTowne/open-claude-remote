---
name: code-review-expert
description: "Expert code review of current git changes with a senior engineer lens. Detects SOLID violations, architecture smells, security risks, code quality issues, and UI/UX compliance. Use when user says 'review code', 'code review', 'check my changes', 'PR review', 'review this PR', 'audit code', or 'review quality'. Do NOT use for debugging, feature implementation, or general code questions."
compatibility: "Requires git CLI. Works best in repositories with convention docs (CLAUDE.md, ARCHITECTURE.md)."
metadata:
  version: 2.0.0
  category: code-quality
  tags: [code-review, solid, security, quality]
---

# Code Review Expert

## Overview

Perform a structured review of the current git changes. **Functional correctness is the primary concern** — verify the code does what it's supposed to do before examining how well it's written. Then review SOLID, architecture, project conventions, security, code quality, test coverage, and UI/UX. Default to review-only output unless the user asks to implement changes.

## Severity Levels

| Level | Name | Description | Action |
|-------|------|-------------|--------|
| **P0** | Critical | Security vulnerability, data loss risk, correctness bug | Must block merge |
| **P1** | High | Logic error, significant SOLID violation, performance regression | Should fix before merge |
| **P2** | Medium | Code smell, maintainability concern, minor SOLID violation | Fix in this PR or create follow-up |
| **P3** | Low | Style, naming, minor suggestion | Optional improvement |

## Workflow

### 1) Preflight context

- Use `git status -sb`, `git diff --stat`, and `git diff` to scope changes.
- If needed, use search tools to find related modules, usages, and contracts.
- Identify entry points, ownership boundaries, and critical paths (auth, payments, data writes, network).

**Preflight guards:**
- **Not a git repo**: If `git status` fails, inform user this skill requires a git repository and stop.
- **No changes**: If both `git diff` and `git diff --staged` are empty, inform user and ask if they want to review a specific commit range (e.g., `git diff HEAD~3..HEAD`).
- **Binary files**: Skip binary files from review, note them in output as "skipped: binary".
- **Reference files missing**: If a reference file listed in Step 2 doesn't exist, proceed with the dimension using built-in knowledge and note "reference not found, using baseline checks" in output.

**Large diff handling (>500 lines changed):**
1. Summarize all changes by file with line counts.
2. Group files by module/feature area.
3. Review one batch at a time, in order of criticality: security-sensitive > core logic > utilities > config/style.
4. Track cross-batch concerns (e.g., a type change in batch 1 affecting consumers in batch 3) and report them in a dedicated "Cross-cutting Findings" section.
5. For extremely large diffs (>2000 lines), ask user if they want to focus on specific files or directories.

**Mixed concerns**: Group findings by logical feature, not just file order.

### 2) Scope classification

Based on changed files from Step 1, determine which review dimensions apply. **Only load references and execute steps for applicable dimensions.**

| Dimension | Trigger condition | Reference to load |
|-----------|-------------------|-------------------|
| **Functional correctness** | **Any code file changed (always first)** | (no reference needed) |
| SOLID + Architecture | Structural changes to modules, classes, or interfaces | `references/solid-checklist.md` |
| Project conventions | Any code file changed AND project convention docs exist | (read project docs directly) |
| Removal candidates | Refactoring, deletions detected, or user explicitly requests | `references/removal-plan.md` |
| Security | Auth, API, DB, network, config, or secrets-related files changed | `references/security-checklist.md` |
| Code quality | Any code file changed | `references/code-quality-checklist.md` |
| Test coverage | Any production code file changed | (no reference needed) |
| UI/UX | `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss` files changed | `references/web-design-rules.md` |

**Skip inapplicable dimensions entirely.** Do not load references that won't be used.

### 3) Functional correctness review (always execute)

This is the most important dimension. Before examining code quality or style, verify the code **actually does the right thing**.

1. **Understand intent**: Infer what the code is supposed to do from function/variable names, comments, commit messages, and surrounding context. If intent is unclear, read related callers and tests.
2. **Logic verification**:
   - Do conditional branches cover all cases? Are there missing `else`/`default` paths?
   - Are boolean expressions correct? Watch for inverted conditions, wrong operators (`&&` vs `||`), operator precedence.
   - Are loop bounds correct? Check off-by-one, termination conditions, and iteration direction.
   - Are return values correct in all paths (including early returns and error paths)?
3. **Data flow**:
   - Is data transformed correctly from input to output?
   - Are intermediate variables used correctly (not stale, not overwritten prematurely)?
   - Are function arguments passed in the correct order?
   - Do SQL queries, API calls, and external interactions match the intended operation?
4. **State and side effects**:
   - Are state transitions correct and complete?
   - Are side effects (DB writes, file I/O, event emissions) happening at the right time and in the right order?
   - On failure, is state left consistent (no partial writes, no dangling resources)?
5. **Caller impact**: Do changes break existing callers? Check changed function signatures, return types, error behavior, and any implicit contracts.

Flag correctness bugs as **P0** (if causes wrong results or data corruption) or **P1** (if causes incorrect behavior in edge cases).

### 4) SOLID + architecture smells

**Skip if not triggered by Step 2.**

- Load `references/solid-checklist.md` and execute all smell checks and refactor heuristics against changed files.
- When you propose a refactor, explain *why* it improves cohesion/coupling and outline a minimal, safe split.
- If refactor is non-trivial, propose an incremental plan instead of a large rewrite.

### 5) Project convention compliance

**Skip if not triggered by Step 2.**

Check if changes adhere to established project conventions.

**Step A — Discover conventions:**
Scan repo root for convention docs (e.g. `CLAUDE.md`, `ARCHITECTURE.md`, `.cursor/rules`, `CONTRIBUTING.md`).
If none found, skip this step and note "No project convention docs detected" in review output.

**Step B — Layer boundary check:**
1. Identify the architectural layers defined in project docs (e.g. controller/service/repository, MVC, hexagonal, etc.)
2. Map each changed file to its layer
3. Flag violations:
   - Layer doing work outside its defined responsibility
   - Cross-layer calls that bypass the expected direction
   - Transaction/commit ownership in wrong layer

**Step C — Convention adherence:**
Check changed code against any project-defined rules on:
- Dependency management (are new imports/packages properly declared?)
- Logging conventions (level, format, output destination)
- Error handling patterns (consistent with project norms?)
- API design (pagination, response format, naming)
- Concurrency patterns (locking, atomic operations per project guidance)

Only flag rules that are **explicitly documented** in project convention files.
Do not invent conventions — if the project doesn't define it, don't enforce it.

### 6) Removal candidates (conditional)

**Only perform this step if:**
- User explicitly requests removal analysis
- Diff contains significant deletions or refactoring
- Dead code or feature flag removal is detected in the diff

Otherwise, skip to Step 7.

- Load `references/removal-plan.md` for template.
- Identify code that is unused, redundant, or feature-flagged off.
- Distinguish **safe delete now** vs **defer with plan**.
- Provide a follow-up plan with concrete steps and checkpoints (tests/metrics).

### 7) Security and reliability scan

**Skip if not triggered by Step 2.**

- Load `references/security-checklist.md` and execute all checks against changed files.
- For each finding, call out both **exploitability** and **impact**.

### 8) Code quality scan

**Skip if not triggered by Step 2.**

- Load `references/code-quality-checklist.md` and execute all checks against changed files.
- Flag issues that may cause silent failures or production incidents.

### 9) Test coverage review

**Skip if no production code files changed.**

Check if changes include adequate test coverage:

1. **Existence check**: Does each modified production module have corresponding test changes?
   - If production code changed but no test added/updated, flag as P1
2. **Coverage breadth**: Do tests cover edge cases?
   - Null/empty values
   - Boundary conditions
   - Error/exception paths
   - Concurrent access patterns (if applicable)
   - Permission/authorization edge cases
3. **Test quality**:
   - Tests verify behavior, not implementation details
   - Tests are independent and repeatable
   - Test names describe the scenario being verified

### 10) UI/UX compliance scan

**Skip if not triggered by Step 2.**

- Load `references/web-design-rules.md` and execute all applicable rule checks against changed frontend files.
- Apply only the categories relevant to the changed code (e.g., skip Forms rules if no form elements changed).

### 11) Output format

Structure your review as follows:

```markdown
## Code Review Summary

**Files reviewed**: X files, Y lines changed
**Dimensions checked**: [list of applicable dimensions from Step 2]
**Overall assessment**: [APPROVE / REQUEST_CHANGES / COMMENT]

---

## Findings

### P0 - Critical
(none or list)

### P1 - High
- **[P1]** `file:line` — Brief title
  - Description of issue
  - Suggested fix

### P2 - Medium
...

### P3 - Low
...

---

## Removal/Iteration Plan
(if applicable)

## Additional Suggestions
(optional improvements, not blocking)
```

**Inline findings** use this format:
```
**[P1]** `path/to/file.ts:42` — Description of the issue and suggested fix.
```

**Clean review**: If no issues found, use this template:
```markdown
## Code Review Summary

**Files reviewed**: X files, Y lines changed
**Dimensions checked**: [list]
**Overall assessment**: APPROVE

No issues found.

### What was verified
- [ ] [Dimension 1] — no violations detected
- [ ] [Dimension 2] — no violations detected

### Not covered
- [e.g., "Integration test execution", "Database migration safety"]

### Recommended follow-up
- [e.g., "Run load test before deploying to production"]
```

### 12) Next steps confirmation

After presenting findings, ask user how to proceed:

```markdown
---

## Next Steps

I found X issues (P0: _, P1: _, P2: _, P3: _).

**How would you like to proceed?**

1. **Fix all** - I'll implement all suggested fixes
2. **Fix P0/P1 only** - Address critical and high priority issues
3. **Fix specific items** - Tell me which issues to fix
4. **No changes** - Review complete, no implementation needed

Please choose an option or provide specific instructions.
```

**Important**: Do NOT implement any changes until user explicitly confirms. This is a review-first workflow.

### 13) Post-fix verification (only after user chooses to fix)

After implementing fixes, verify quality before reporting completion:

1. **Re-diff**: Run `git diff` on modified files to confirm changes are correct.
2. **Regression check**: Verify fixes don't introduce new issues in the same dimensions reviewed.
3. **Delta summary**: Present a brief summary:
   ```
   Fixed: X issues (P0: _, P1: _, P2: _, P3: _)
   Remaining: Y issues (list if any)
   New issues introduced: Z (should be 0)
   ```
4. If new issues found, fix them before reporting completion.

## Examples

### Example 1: Backend logic change
User says: "review my code"
Actions:
1. Run git diff, find changes in service and repository files
2. Scope: Functional correctness + SOLID + Project conventions + Code quality + Test coverage
3. **First**: Verify logic correctness — are conditionals complete, data flow correct, callers unbroken?
4. Load `solid-checklist.md` and `code-quality-checklist.md`
5. Read project convention docs, check layer boundary compliance
6. Check if corresponding tests were updated
Result: Structured review with correctness bugs as P0, other findings grouped by P1-P3

### Example 2: Frontend component change
User says: "check my changes"
Actions:
1. Run git diff, find changes in `.tsx` files only
2. Scope: Functional correctness + Code quality + UI/UX + Test coverage
3. **First**: Verify render logic — correct props passed, conditional rendering complete, event handlers wired correctly?
4. Load `code-quality-checklist.md` + `web-design-rules.md`
5. Check accessibility, focus states, content handling
Result: Review with correctness and UI/UX findings

### Example 3: Security-sensitive change
User says: "PR review"
Actions:
1. Run git diff, find changes in auth middleware and API routes
2. Scope: Functional correctness + Security + Project conventions + Code quality + Test coverage
3. **First**: Verify auth logic correctness — are permission checks complete, token validation correct, role comparisons right?
4. Load `security-checklist.md` + `code-quality-checklist.md`
5. Deep-check AuthN/AuthZ, injection, race conditions
6. Verify tests cover permission edge cases
Result: Correctness + security focused review with P0/P1 findings prioritized

## Resources

### references/

| File | Purpose |
|------|---------|
| `solid-checklist.md` | SOLID smell prompts and refactor heuristics |
| `security-checklist.md` | Web/app security and runtime risk checklist |
| `code-quality-checklist.md` | Error handling, performance, boundary conditions |
| `removal-plan.md` | Template for deletion candidates and follow-up plan |
| `web-design-rules.md` | UI/UX compliance rules for frontend files |
