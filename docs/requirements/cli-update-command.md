# CLI Update Command

## Description

Provide a convenient `claude-remote update` subcommand that automatically detects the package manager (npm/pnpm) used for installation and runs the appropriate global update command.

## Acceptance Criteria

- [ ] `claude-remote update` checks current version against npm registry latest
- [ ] If already up to date, prints friendly message and exits
- [ ] If new version available, shows version diff (current -> latest)
- [ ] Automatically detects whether installed via npm or pnpm
- [ ] Runs the correct update command (`npm install -g` or `pnpm add -g`) with stdio inherited
- [ ] On update failure, shows manual update command for user to copy-paste
- [ ] 2-minute timeout protection for the update process
- [ ] `claude-remote --help` includes update subcommand in usage and examples

## Architecture Notes

- Implementation in `backend/src/update.ts` (5 exported functions)
- Uses only Node.js built-in modules (`node:https`, `node:child_process`, `node:fs`)
- Package manager detection based on `fs.realpathSync(process.argv[1])` path analysis
- Dynamic import in `cli.ts` (same pattern as `attach` subcommand)
