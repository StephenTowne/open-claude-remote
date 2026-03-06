---
name: clean-for-npm-test
description: Clean project environment for npm install testing. Stops running instances, removes build artifacts (dist/, frontend-dist/, node_modules/, *.tgz, *.tsbuildinfo), unlinks global npm package, and cleans runtime data. Use when user says "clean for npm test", "prepare npm test", "npm install test cleanup", "清理测试环境", "npm测试准备", or before testing npm published package.
---

# Clean for npm Install Testing

Run `scripts/clean.sh` from the skill directory to clean the entire project environment for npm package testing.

```bash
bash .claude/skills/clean-for-npm-test/scripts/clean.sh
```

## What it cleans

1. **Stop services**: `pnpm stop` + kill lingering `tsx`/`node` processes
2. **Build artifacts**: `dist/`, `frontend-dist/`, `backend/shared-dist/`, `*.tsbuildinfo`, `*.tgz`
3. **Dependencies**: `node_modules/`
4. **Global link**: `npm uninstall -g @caoruhua/open-claude-remote`
5. **Runtime data**: `~/.claude-remote/instances.json` and `logs/` (keeps config.json, vapid-keys.json, push-subscriptions.json, settings/)

## Options

- `--keep-runtime`: Skip step 5, only clean project directory

## After cleanup

Project is ready for `npm install -g @caoruhua/open-claude-remote` from npm registry.
