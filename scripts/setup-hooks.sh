#!/bin/bash
# Setup Claude Code Notification Hook for remote approval
# This adds a hook that sends permission_prompt notifications to the proxy server

set -e

SETTINGS_FILE="$HOME/.claude/settings.json"
PROXY_URL="${1:-http://localhost:3000}"

echo "Setting up Claude Code hooks for remote approval..."
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
    ]
  }
}')

if [ -f "$SETTINGS_FILE" ]; then
  echo "Merging hook configuration into existing settings..."
  MERGED=$(jq -s '.[0] * .[1]' "$SETTINGS_FILE" <(echo "$HOOK_CONFIG"))
  echo "$MERGED" > "$SETTINGS_FILE"
  echo "Updated $SETTINGS_FILE with hook configuration."
else
  echo "$HOOK_CONFIG" > "$SETTINGS_FILE"
  echo "Created $SETTINGS_FILE with hook configuration."
fi

echo ""
echo "Done! Claude Code will now notify the proxy when approval is needed."
