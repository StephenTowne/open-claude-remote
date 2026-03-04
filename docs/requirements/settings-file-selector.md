# Settings File Selector

## Requirement

Users should be able to select a custom settings file when creating a Claude Code instance from the web UI, allowing per-project configuration of Claude settings.

## User Story

As a developer working on multiple projects, I want to select different settings profiles when spawning new Claude instances, so that each project can have its own configuration (permissions, environment variables, etc.) without manual `--settings` argument typing.

## Acceptance Criteria

1. **Settings file discovery**
   - System scans `~/.claude/` and `~/.claude-remote/settings/` by default
   - Additional directories configurable via `settingsDirs` option
   - Only files matching `settings*.json` pattern are listed
   - Port config files (e.g., `3000.json`) are excluded

2. **Security**
   - Filenames with path traversal patterns (`../`, `..\\`) are rejected
   - Only `.json` extension files are considered
   - No arbitrary file access — only configured directories are scanned

3. **Web UI**
   - Settings selector displayed in "Create Instance" modal
   - Shows `displayName (directory)` format to distinguish same-named files
   - Dropdown shows "None" as default option
   - Hidden when no settings files found

4. **Integration**
   - Selected settings file passed as `--settings <path>` to Claude CLI
   - Merge with existing hook injection (hooks are appended to user settings)

## Configuration

```json
{
  "settingsDirs": [
    "~/.claude/",
    "~/.claude-remote/settings/",
    "~/custom-settings/"
  ]
}
```

## Display Name Convention

- `settings-project-a.json` → `project-a`
- `settings.idea.json` → `idea`
- `settings.json` → `settings` (original basename preserved when stripped prefix is empty)