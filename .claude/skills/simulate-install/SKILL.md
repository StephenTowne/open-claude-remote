---
name: simulate-install
description: Simulate a real npm/pnpm global install from the registry and verify the installation. Use when user says "simulate install", "模拟安装", "test install", "测试安装", or wants to verify the published npm package works correctly.
---

# Simulate Install Skill

Simulate a real user installing `@caoruhua/open-claude-remote` from npm registry, then verify the installation is functional.

## Usage

```bash
bash .claude/skills/simulate-install/scripts/simulate-install.sh [--npm|--pnpm]
```

- `--pnpm` (default): Install via `pnpm add -g`
- `--npm`: Install via `npm install -g`

## What It Does

1. **Clean environment**: Stop running instances, kill residual processes, uninstall existing global packages, clean runtime data (keeps config.json)
2. **Install from registry**: `pnpm add -g @caoruhua/open-claude-remote` or `npm install -g @caoruhua/open-claude-remote`
3. **Run verification checks**:
   - `claude-remote` command exists
   - `--version` outputs correct format
   - `--help` outputs usage info
   - spawn-helper has execute permission
   - `dist/backend/src/cli.js` exists in install path
   - `frontend-dist/` is non-empty
4. **Report results**: Summary table with PASS/FAIL/WARN for each check

## Important Notes

- This skill installs from the **npm registry**, not from local source. Make sure you have published (`npm publish`) before running.
- This skill does NOT restore the development environment. Use `/dev-link` afterward if you want to go back to local development.
- spawn-helper permission check reports the **natural state** — WARN (no +x) means the runtime fix in `fix-pty-permissions.ts` will be needed.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Check 1 fails (command not found) | Install failed or PATH not set | Check `pnpm bin -g` / `npm bin -g` is in PATH |
| Check 2 fails (version mismatch) | Old version cached | `npm cache clean --force` or `pnpm store prune` |
| Check 4 warns (no +x) | pnpm skips build scripts | Expected — runtime fix handles this |
| Check 5/6 fails (missing files) | `files` field in package.json incomplete | Check `package.json` files array |
