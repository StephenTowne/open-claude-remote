#!/usr/bin/env bash
# Clean project for npm install testing
# Usage: bash scripts/clean.sh [--keep-runtime]
#   --keep-runtime: skip cleaning ~/.claude-remote/ runtime data

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RUNTIME_DIR="$HOME/.claude-remote"
KEEP_RUNTIME=false

for arg in "$@"; do
  case "$arg" in
    --keep-runtime) KEEP_RUNTIME=true ;;
  esac
done

echo "=== Step 1: Stop running instances ==="
# Kill registered instances via registry PID list (no pnpm/tsx dependency)
INSTANCES_FILE="$RUNTIME_DIR/instances.json"
if [ -f "$INSTANCES_FILE" ]; then
  # Extract PIDs using lightweight JSON parsing (no jq dependency required)
  PIDS=$(grep -o '"pid":[[:space:]]*[0-9]*' "$INSTANCES_FILE" | grep -o '[0-9]*')
  if [ -n "$PIDS" ]; then
    for pid in $PIDS; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null && echo "  Sent SIGTERM to PID $pid" || true
      fi
    done
    # Brief wait for graceful shutdown
    sleep 1
    echo "  Cleared registered instances"
  else
    echo "  No registered instances found"
  fi
  # Clear the registry file
  echo '{"version":1,"instances":[]}' > "$INSTANCES_FILE"
else
  echo "  No instances registry found"
fi

# Kill any lingering processes (fallback for unregistered orphans)
pkill -f "tsx backend/src" 2>/dev/null && echo "  Killed tsx dev processes" || true
pkill -f "node dist/backend/src" 2>/dev/null && echo "  Killed node production processes" || true

echo ""
echo "=== Step 2: Remove build artifacts ==="
rm -rf "$PROJECT_ROOT/dist" && echo "  Removed dist/"
rm -rf "$PROJECT_ROOT/frontend-dist" && echo "  Removed frontend-dist/"
rm -rf "$PROJECT_ROOT/backend/shared-dist" && echo "  Removed backend/shared-dist/"
rm -f "$PROJECT_ROOT/frontend/tsconfig.tsbuildinfo" && echo "  Removed frontend/tsconfig.tsbuildinfo"
rm -f "$PROJECT_ROOT"/*.tgz && echo "  Removed *.tgz pack artifacts"

echo ""
echo "=== Step 3: Remove node_modules ==="
rm -rf "$PROJECT_ROOT/node_modules" && echo "  Removed node_modules/"

echo ""
echo "=== Step 4: Unlink global packages ==="
# npm global
if npm ls -g --depth=0 2>/dev/null | grep -q "@caoruhua/open-claude-remote"; then
  npm uninstall -g @caoruhua/open-claude-remote && echo "  [npm] Unlinked @caoruhua/open-claude-remote"
else
  echo "  [npm] No global link found"
fi
# pnpm global
if command -v pnpm &>/dev/null && pnpm ls -g 2>/dev/null | grep -q "claude-remote"; then
  pnpm uninstall -g @caoruhua/open-claude-remote 2>/dev/null && echo "  [pnpm] Unlinked @caoruhua/open-claude-remote" || true
  # Also clean stale frontend link if present
  pnpm uninstall -g frontend 2>/dev/null && echo "  [pnpm] Removed stale 'frontend' global link" || true
else
  echo "  [pnpm] No global link found"
fi

if [ "$KEEP_RUNTIME" = false ]; then
  echo ""
  echo "=== Step 5: Clean runtime data ==="
  rm -f "$RUNTIME_DIR/instances.json" && echo "  Removed instances.json"
  rm -rf "$RUNTIME_DIR/logs" && echo "  Removed logs/"
  rm -rf "$RUNTIME_DIR/settings" && echo "  Removed settings/"
  echo "  Kept: config.json, vapid-keys.json, push-subscriptions.json"
else
  echo ""
  echo "=== Step 5: Skipped runtime cleanup (--keep-runtime) ==="
fi

echo ""
echo "=== Done! Ready for: npm install -g @caoruhua/open-claude-remote ==="
