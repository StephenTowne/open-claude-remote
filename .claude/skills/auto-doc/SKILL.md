---
name: auto-doc
description: >
  Maintains project navigation docs (ARCHITECTURE.md + INDEX.md) as an AI context compression protocol.
  Use when user says "update docs", "auto-doc", "regenerate docs", "check doc quality",
  or when a task involves structural file changes (add/delete/rename source files).
  Supports: `/auto-doc` (incremental), `/auto-doc regenerate` (full rebuild), `/auto-doc quality` (description audit).
metadata:
  author: zhihui.tzh
  version: 1.3.0
---

# Critical: Auto-trigger Decision Gate

After completing any coding task, check before responding to user:

```
git diff --name-status HEAD -- "*.py" "*.ts" "*.tsx" "*.go" "*.java" "*.rs" "*.rb" "*.kt" "*.swift" | grep "^[ADR]"
```

> Adapt file patterns to your project's languages. The above covers common languages.

- **Has A/D/R output** → Execute incremental update (Step 1-4) before finishing
- **No A/D/R output (only M)** → Skip. Do NOT trigger for content-only modifications
- When changed files are E2E tests, include them in INDEX scope (same template style as existing INDEX entries)

## When to Skip (overrides trigger)

- Content modifications (M): bug fixes, logic changes → **never trigger**
- Test files（`test_`/`_test`/`.test.`/`.spec.`）, comments, docstrings, config files, build artifacts → **skip**
- **E2E test files are an exception**: include them in INDEX using existing template style (e.g. `tests/e2e/**`, `**/*.e2e.*`)

---

# Modes

| Invocation | Action |
|---|---|
| `/auto-doc` | Staleness check → incremental update if needed |
| `/auto-doc regenerate` | Skip check → full rebuild all docs |
| `/auto-doc quality` | Skip check → audit & improve existing descriptions only |

---

# Incremental Update (default)

## Step 1: Staleness Check

```bash
LAST_DOC_COMMIT=$(git log -1 --format="%H" -- "*/INDEX.md" "ARCHITECTURE.md")
git diff --name-status ${LAST_DOC_COMMIT:-HEAD~20}..HEAD -- \
  "*.py" "*.ts" "*.tsx" "*.go" "*.java" "*.rs" "*.rb" "*.kt" "*.swift" \
  | grep "^[ADR]"
```

> Adapt file patterns to your project's languages.

- No output → print "文档已是最新，无需更新" and stop
- Has output → continue to Step 2

## Step 2: Scope

Identify which INDEX.md files need updating based on changed file directories.
If new directories/domains detected → also update ARCHITECTURE.md.

## Step 3: Update

For each affected INDEX.md:
1. Read current INDEX.md + `ls` actual files in directory
2. Diff: add new entries, remove deleted entries
3. For new files: generate description per `references/quality-rules.md`

For ARCHITECTURE.md (only when new domain/route/integration added):
1. Update Domain Map file references
2. Update Routes if new routes registered
3. Update Data Flow if new external integration

## Step 4: Validate

For each INDEX.md:
- Every listed file actually exists on disk
- Every source file in directory is listed (excluding `__init__.py` etc.)

---

# Regenerate Mode

When `/auto-doc regenerate`:

1. **Scan** — Find all source files (exclude node_modules, __pycache__, dist)
2. **Generate INDEX.md** — For each trackable directory (see `references/format-spec.md` for criteria)
3. **Quality self-check** — Apply description quality rules from `references/quality-rules.md`
4. **Generate ARCHITECTURE.md** — Preserve Stack/Key Patterns, rebuild Routes + Domain Map
5. **Validate** — All file references are bidirectionally consistent
6. **Output summary**

---

# Quality Mode

When `/auto-doc quality`:

1. **Read** all INDEX.md files + ARCHITECTURE.md
2. **Detect** low-quality INDEX.md entries per `references/quality-rules.md` (filename-translation detection)
3. **Rewrite** flagged entries by reading file headers (first 50 lines)
4. **Audit** ARCHITECTURE.md: stale Domain Map refs, missing Routes, outdated Data Flow/Key Patterns
5. **Output summary** with counts: scanned / enhanced / skipped / ARCHITECTURE issues

---

# Format Specs & Quality Rules

Detailed specifications are in linked reference files — consult as needed:

- `references/format-spec.md` — Tier 1/2/3 document templates, trackable directory criteria, change-type decision table
- `references/quality-rules.md` — Description quality standards, "cover filename" test, detection algorithm, ARCHITECTURE.md audit checklist

---

# Examples

## Example 1: User adds a new service file

User creates `src/services/payment_service.py`.

Actions:
1. Auto-trigger detects `A services/payment_service.py`
2. Read `src/services/INDEX.md`
3. Read first 50 lines of `payment_service.py` → extract: `PaymentService`, imports `stripe`, methods `create_checkout_session`, `handle_webhook`
4. Add entry: `- payment_service.py: PaymentService，Stripe Checkout会话创建 + webhook签名校验`
5. Check if new domain needed in ARCHITECTURE.md → No (fits existing "支付" domain) → skip
6. Validate INDEX.md completeness

## Example 2: User deletes an API file

User deletes `src/api/legacy/orders.py`.

Actions:
1. Auto-trigger detects `D api/legacy/orders.py`
2. Remove `- orders.py: ...` line from `src/api/legacy/INDEX.md`
3. Check ARCHITECTURE.md Domain Map → remove `api: orders.py` from 订单 section
4. Validate

## Example 3: `/auto-doc quality`

Actions:
1. Scan all INDEX.md files → 85 entries
2. Flag `user_service.py: 用户服务` — description ⊆ filename translation
3. Read file header → rewrite to `UserService，注册/登录/JWT刷新，集成OAuth2 + RBAC权限校验`
4. Check ARCHITECTURE.md Routes vs actual entry point → all consistent
5. Output: 80 enhanced, 5 skipped, 0 ARCHITECTURE issues

---

# Troubleshooting

## INDEX.md validation fails — file listed but not on disk

Cause: File was deleted but INDEX.md not updated (usually manual edit or merge conflict).
Solution: Remove the stale entry. Run `ls` on the directory to confirm actual files.

## Description keeps reverting to filename translation

Cause: File has no docstring and the only hint is the filename.
Solution: Read deeper (first 50 lines) to find class/function names and imports. Compose description from code structure, not filename.

## ARCHITECTURE.md Domain Map out of sync

Cause: Files added/deleted without running auto-doc.
Solution: Run `/auto-doc regenerate` to rebuild from scratch, or `/auto-doc quality` to audit references.

## Auto-trigger fires on test-only changes

Cause: Test file matched source file pattern.
Solution: The staleness check grep excludes `test_|_test.|.test.|.spec.` patterns. If still triggering, verify the file naming follows test conventions.
