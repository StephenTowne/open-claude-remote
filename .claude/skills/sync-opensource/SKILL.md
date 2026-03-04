---
name: sync-opensource
description: >
  Sync master branch to opensource branch and push to GitHub.
  Use when user says "sync opensource", "sync to github", "push to opensource",
  "同步开源", "推送到github", or "/sync-opensource".
  Merges master into opensource, removes internal-only files,
  and pushes to the GitHub remote.
metadata:
  author: zhihui.tzh
  version: 1.0.0
---

# Sync Opensource

One-command sync from internal master to GitHub opensource.

## Workflow

Run the sync script and report results:

```bash
cd $PROJECT_ROOT && bash .claude/skills/sync-opensource/scripts/sync-opensource.sh
```

After the script completes, report the outcome to the user:
- **Success**: show the commit hash and confirm push to github/main
- **Failure**: show the error message and suggest next steps

## What the script does

1. Pre-flight: verify on master, clean working tree, commits to sync
2. Fix upstream: ensure opensource tracks github/main (not github/opensource)
3. Switch to opensource branch
4. Merge master (--no-commit --no-ff)
5. Remove excluded internal files
6. Ensure .gitignore exclusion entries preserved
7. Check for code conflicts (abort if any)
8. Commit merge and push to github/main
9. Return to master

## Error Handling

- Uncommitted changes → tell user to commit or stash first
- Merge conflicts on code files → report conflicting files, suggest manual resolution
- Push failed → report error, suggest retry
- Script auto-returns to master on any failure

## Excluded Files

`.claude/`, `.aci/`, `CLAUDE.md`, `ARCHITECTURE.md`, `LEGAL.md`

Edit `scripts/sync-opensource.sh` EXCLUDED_PATHS to modify the list.
