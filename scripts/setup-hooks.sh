#!/bin/bash
# Setup Claude Code Hooks for remote approval and interactive questions
# This adds hooks that:
# 1. Send permission_prompt notifications to the proxy server (Notification hook)
# 2. Intercept AskUserQuestion tool calls for structured question UI (PreToolUse hook)

set -e

SETTINGS_FILE="$HOME/.claude/settings.json"
PROXY_URL="${1:-http://localhost:3000}"

echo "Setting up Claude Code hooks for remote approval + interactive questions..."
echo "Proxy URL: $PROXY_URL"

# Create .claude dir if needed
mkdir -p "$HOME/.claude"

if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not found. Install it with: brew install jq"
  exit 1
fi

# Use jq --arg to safely embed the command string (handles quotes/special chars)
HOOK_COMMAND="curl -s -X POST ${PROXY_URL}/api/hook -H 'Content-Type: application/json' -d \"\$(cat)\""

HOOK_CONFIG=$(jq -n --arg cmd "$HOOK_COMMAND" '{
  hooks: {
    Notification: [
      {
        matcher: "permission_prompt",
        hooks: [
          {
            type: "command",
            command: $cmd
          }
        ]
      }
    ],
    PreToolUse: [
      {
        matcher: "AskUserQuestion",
        hooks: [
          {
            type: "command",
            command: $cmd
          }
        ]
      }
    ]
  }
}')

if [ -f "$SETTINGS_FILE" ]; then
  BACKUP_FILE="$SETTINGS_FILE.bak.$(date +%Y%m%d%H%M%S)"
  cp "$SETTINGS_FILE" "$BACKUP_FILE"
  echo "Backed up existing settings to: $BACKUP_FILE"

  echo "Merging hook configuration into existing settings..."
  MERGED=$(jq -n \
    --argfile existing "$SETTINGS_FILE" \
    --argjson incoming "$HOOK_CONFIG" '
      def merge_hook_array(existing; incoming):
        ((existing // []) + (incoming // []))
        | unique_by(.matcher + "|" + ((.hooks // [])[0].command // ""));

      ($existing // {}) as $e
      | ($incoming // {}) as $i
      | {
          hooks: {
            Notification: merge_hook_array(($e.hooks.Notification // []); ($i.hooks.Notification // [])),
            PreToolUse: merge_hook_array(($e.hooks.PreToolUse // []); ($i.hooks.PreToolUse // []))
          }
        }
      | ($e * .)
    ')
  echo "$MERGED" > "$SETTINGS_FILE"
  echo "Updated $SETTINGS_FILE with hook configuration (idempotent merge)."
else
  echo "$HOOK_CONFIG" > "$SETTINGS_FILE"
  echo "Created $SETTINGS_FILE with hook configuration."
fi

echo ""
echo "Done! Configured two hooks:"
echo "  1. Notification (permission_prompt) → remote approval on phone"
echo "  2. PreToolUse (AskUserQuestion) → structured question panel on phone"
