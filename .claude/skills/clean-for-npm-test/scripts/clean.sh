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
cd "$PROJECT_ROOT"
if [ -f "node_modules/.pnpm/tsx@*/node_modules/tsx/dist/cli.mjs" ] || command -v tsx &>/dev/null; then
  pnpm stop 2>/dev/null && echo "  Stopped registered instances" || echo "  No instances to stop (or pnpm stop unavailable)"
else
  echo "  Skipped pnpm stop (tsx not available)"
fi

# Kill any lingering processes
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
# npx cache
if [ -d "$HOME/.npm/_npx" ]; then
  rm -rf "$HOME/.npm/_npx" && echo "  Cleared npx cache (~/.npm/_npx/)"
fi

if [ "$KEEP_RUNTIME" = false ]; then
  echo ""
  echo "=== Step 5: Clean runtime data ==="
  rm -f "$RUNTIME_DIR/instances.json" && echo "  Removed instances.json"
  rm -rf "$RUNTIME_DIR/logs" && echo "  Removed logs/"
  echo "  Kept: config.json, vapid-keys.json, push-subscriptions.json, settings/"
else
  echo ""
  echo "=== Step 5: Skipped runtime cleanup (--keep-runtime) ==="
fi

echo ""
echo "=== Done! Ready for: npm install -g @caoruhua/open-claude-remote ==="
