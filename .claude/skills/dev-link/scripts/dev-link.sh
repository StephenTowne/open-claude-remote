#!/usr/bin/env bash
# Dev Link - Link local project to global pnpm
# Usage: bash scripts/dev-link.sh
#
# This script ensures `claude-remote` uses local build instead of npm published version.
# It handles both npm and pnpm global installations before linking.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
PACKAGE_NAME="@caoruhua/open-claude-remote"

# Step 1: Verify project root
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  echo "❌ Error: package.json not found at $PROJECT_ROOT"
  exit 1
fi

echo "=== Step 1: Remove existing global installations ==="

# Check and remove npm global installation
if npm list -g "$PACKAGE_NAME" &>/dev/null; then
  echo "Removing npm global installation..."
  npm uninstall -g "$PACKAGE_NAME" || true
fi

# Check pnpm global status
PNPM_LIST_OUTPUT=$(pnpm list -g "$PACKAGE_NAME" 2>/dev/null || true)
if echo "$PNPM_LIST_OUTPUT" | grep -q "$PACKAGE_NAME"; then
  # Check if it's already a link by looking for "link:" in the output
  if echo "$PNPM_LIST_OUTPUT" | grep -q "link:"; then
    echo "Existing pnpm link detected, will update..."
  else
    echo "Removing pnpm global installation..."
    pnpm remove -g "$PACKAGE_NAME" || true
  fi
fi

echo ""
echo "=== Step 2: Link to global pnpm ==="
cd "$PROJECT_ROOT"
pnpm link -g

echo ""
echo "=== Step 3: Build project ==="
pnpm build

echo ""
echo "=== Step 4: Verify link status ==="
pnpm list -g "$PACKAGE_NAME"

echo ""
echo "=== Done! ==="
echo "Now \`claude-remote\` command uses local project build."
echo "Run \`pnpm build && claude-remote\` after code changes."