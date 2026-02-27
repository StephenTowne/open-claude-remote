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

# Hook command: reads stdin (hook payload) and POSTs to proxy
HOOK_COMMAND="curl -s -X POST ${PROXY_URL}/api/hook -H 'Content-Type: application/json' -d \"\$(cat)\""

# Build the hook config
HOOK_CONFIG=$(cat <<EOF
{
  "hooks": {
    "Notification": [
      {
        "matcher": "permission_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "${HOOK_COMMAND}"
          }
        ]
      }
    ]
  }
}
EOF
)

if [ -f "$SETTINGS_FILE" ]; then
  # Try to merge with jq if available
  if command -v jq &> /dev/null; then
    echo "Merging hook configuration into existing settings..."
    MERGED=$(jq -s '.[0] * .[1]' "$SETTINGS_FILE" <(echo "$HOOK_CONFIG"))
    echo "$MERGED" > "$SETTINGS_FILE"
    echo "Updated $SETTINGS_FILE with hook configuration."
  else
    echo "Existing settings found at $SETTINGS_FILE"
    echo "jq not found — cannot auto-merge. Please manually add this hook configuration:"
    echo ""
    echo "$HOOK_CONFIG"
    echo ""
    echo "Install jq to enable auto-merge: brew install jq"
  fi
else
  echo "$HOOK_CONFIG" > "$SETTINGS_FILE"
  echo "Created $SETTINGS_FILE with hook configuration."
fi

echo ""
echo "Done! Claude Code will now notify the proxy when approval is needed."
