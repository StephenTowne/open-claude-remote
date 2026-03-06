#!/usr/bin/env bash
# Simulate Install - Install from npm registry and verify
# Usage: bash scripts/simulate-install.sh [--npm|--pnpm]
#
# Simulates a real user installing @caoruhua/open-claude-remote globally,
# then runs verification checks to ensure the package works correctly.

set -euo pipefail

PACKAGE_NAME="@caoruhua/open-claude-remote"
BIN_NAME="claude-remote"
RUNTIME_DIR="$HOME/.claude-remote"
INSTALLER="pnpm"  # default

for arg in "$@"; do
  case "$arg" in
    --npm)  INSTALLER="npm" ;;
    --pnpm) INSTALLER="pnpm" ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: simulate-install.sh [--npm|--pnpm]"
      exit 1
      ;;
  esac
done

echo "=== Simulate Install ($INSTALLER) ==="
echo ""

# -------------------------------------------------------
# Step 1: Clean environment
# -------------------------------------------------------
echo "=== Step 1: Clean environment ==="

# Stop registered instances
INSTANCES_FILE="$RUNTIME_DIR/instances.json"
if [ -f "$INSTANCES_FILE" ]; then
  PIDS=$(grep -o '"pid":[[:space:]]*[0-9]*' "$INSTANCES_FILE" | grep -o '[0-9]*' || true)
  if [ -n "$PIDS" ]; then
    for pid in $PIDS; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null && echo "  Sent SIGTERM to PID $pid" || true
      fi
    done
    sleep 1
    echo "  Cleared registered instances"
  fi
fi

# Kill lingering processes
pkill -f "tsx backend/src" 2>/dev/null && echo "  Killed tsx dev processes" || true
pkill -f "node dist/backend/src" 2>/dev/null && echo "  Killed node production processes" || true

# Uninstall existing global packages (both npm and pnpm)
if npm ls -g --depth=0 2>/dev/null | grep -q "$PACKAGE_NAME"; then
  npm uninstall -g "$PACKAGE_NAME" && echo "  [npm] Uninstalled $PACKAGE_NAME" || true
else
  echo "  [npm] No global installation found"
fi

if command -v pnpm &>/dev/null; then
  if pnpm ls -g 2>/dev/null | grep -q "claude-remote"; then
    pnpm remove -g "$PACKAGE_NAME" 2>/dev/null && echo "  [pnpm] Uninstalled $PACKAGE_NAME" || true
  else
    echo "  [pnpm] No global installation found"
  fi
fi

# Clean runtime data (keep config.json and push-related files)
if [ -d "$RUNTIME_DIR" ]; then
  rm -f "$RUNTIME_DIR/instances.json" 2>/dev/null && echo "  Removed instances.json" || true
  rm -rf "$RUNTIME_DIR/logs" 2>/dev/null && echo "  Removed logs/" || true
  echo "  Kept: config.json, vapid-keys.json, push-subscriptions.json"
fi

echo ""

# -------------------------------------------------------
# Step 2: Install from npm registry
# -------------------------------------------------------
echo "=== Step 2: Install from npm registry ($INSTALLER) ==="

if [ "$INSTALLER" = "pnpm" ]; then
  pnpm add -g "$PACKAGE_NAME"
else
  npm install -g "$PACKAGE_NAME"
fi

echo ""

# -------------------------------------------------------
# Step 3: Verification checks
# -------------------------------------------------------
echo "=== Step 3: Verification ==="

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
RESULTS=()

# Helper: record check result
record() {
  local num="$1" name="$2" status="$3" detail="${4:-}"
  if [ "$status" = "PASS" ]; then
    ((PASS_COUNT++))
    RESULTS+=("Check $num: $name    PASS${detail:+ ($detail)}")
  elif [ "$status" = "WARN" ]; then
    ((WARN_COUNT++))
    RESULTS+=("Check $num: $name    WARN${detail:+ ($detail)}")
  else
    ((FAIL_COUNT++))
    RESULTS+=("Check $num: $name    FAIL${detail:+ ($detail)}")
  fi
}

# --- Check 1: command exists ---
if command -v "$BIN_NAME" &>/dev/null; then
  CMD_PATH=$(command -v "$BIN_NAME")
  record 1 "$BIN_NAME command" "PASS" "$CMD_PATH"
else
  record 1 "$BIN_NAME command" "FAIL" "not found in PATH"
  # Cannot proceed with checks 2-3 if command missing
  record 2 "--version" "FAIL" "command not found"
  record 3 "--help" "FAIL" "command not found"

  echo ""
  echo "=== Simulation Results ==="
  for r in "${RESULTS[@]}"; do echo "$r"; done
  echo "================================"
  echo "FAILED ($FAIL_COUNT failures)"
  exit 1
fi

# --- Check 2: --version ---
VERSION_OUTPUT=$("$BIN_NAME" --version 2>&1 || true)
if echo "$VERSION_OUTPUT" | grep -qE "^claude-remote v[0-9]+\.[0-9]+\.[0-9]+"; then
  VERSION=$(echo "$VERSION_OUTPUT" | grep -oE "v[0-9]+\.[0-9]+\.[0-9]+")
  record 2 "--version" "PASS" "$VERSION"
else
  record 2 "--version" "FAIL" "got: $VERSION_OUTPUT"
fi

# --- Check 3: --help ---
HELP_OUTPUT=$("$BIN_NAME" --help 2>&1 || true)
if echo "$HELP_OUTPUT" | grep -q "Usage:"; then
  record 3 "--help" "PASS"
else
  record 3 "--help" "FAIL" "missing 'Usage:' in output"
fi

# --- Check 4: spawn-helper permissions ---
# Resolve the install path from the binary location
REAL_BIN=$(realpath "$(command -v "$BIN_NAME")")
INSTALL_DIR=$(dirname "$(dirname "$(dirname "$(dirname "$REAL_BIN")")")")

# Look for spawn-helper in node-pty prebuilds
SPAWN_HELPER_FOUND=false
SPAWN_HELPER_EXEC=false

# Search for node-pty in the install tree
find_spawn_helpers() {
  local search_base="$1"
  # Try common locations for node-pty prebuilds
  for candidate in \
    "$search_base/node_modules/node-pty/prebuilds" \
    "$search_base/node_modules/.pnpm/node-pty-*/node_modules/node-pty/prebuilds"; do
    # Use glob expansion
    for prebuilds_dir in $candidate; do
      if [ -d "$prebuilds_dir" ]; then
        echo "$prebuilds_dir"
        return 0
      fi
    done
  done
  return 1
}

PREBUILDS_DIR=$(find_spawn_helpers "$INSTALL_DIR" 2>/dev/null || true)
if [ -z "$PREBUILDS_DIR" ]; then
  # Try one level up (pnpm global store structure)
  PARENT_DIR=$(dirname "$INSTALL_DIR")
  PREBUILDS_DIR=$(find_spawn_helpers "$PARENT_DIR" 2>/dev/null || true)
fi

if [ -n "$PREBUILDS_DIR" ] && [ -d "$PREBUILDS_DIR" ]; then
  # Check all platform dirs for spawn-helper
  for platform_dir in "$PREBUILDS_DIR"/*/; do
    helper="$platform_dir/spawn-helper"
    if [ -f "$helper" ]; then
      SPAWN_HELPER_FOUND=true
      if [ -x "$helper" ]; then
        SPAWN_HELPER_EXEC=true
      fi
      break
    fi
  done
fi

if [ "$SPAWN_HELPER_FOUND" = true ]; then
  if [ "$SPAWN_HELPER_EXEC" = true ]; then
    record 4 "spawn-helper perms" "PASS" "+x"
  else
    record 4 "spawn-helper perms" "WARN" "no +x, runtime fix needed"
  fi
else
  record 4 "spawn-helper perms" "WARN" "spawn-helper not found (may be bundled differently)"
fi

# --- Check 5: dist/backend/src/cli.js exists ---
CLI_JS="$INSTALL_DIR/dist/backend/src/cli.js"
if [ -f "$CLI_JS" ]; then
  record 5 "dist/ completeness" "PASS"
else
  # Try alternate path patterns for pnpm global store
  ALT_CLI=$(dirname "$REAL_BIN")
  if [ -f "$ALT_CLI/cli.js" ]; then
    record 5 "dist/ completeness" "PASS" "found at $ALT_CLI/cli.js"
  else
    record 5 "dist/ completeness" "FAIL" "cli.js not found"
  fi
fi

# --- Check 6: frontend-dist/ non-empty ---
FRONTEND_DIST="$INSTALL_DIR/frontend-dist"
if [ -d "$FRONTEND_DIST" ]; then
  FILE_COUNT=$(find "$FRONTEND_DIST" -type f | wc -l | tr -d ' ')
  if [ "$FILE_COUNT" -gt 0 ]; then
    record 6 "frontend-dist/" "PASS" "$FILE_COUNT files"
  else
    record 6 "frontend-dist/" "FAIL" "directory is empty"
  fi
else
  record 6 "frontend-dist/" "FAIL" "directory not found at $FRONTEND_DIST"
fi

# -------------------------------------------------------
# Step 4: Summary
# -------------------------------------------------------
echo ""
echo "=== Simulation Results ==="
for r in "${RESULTS[@]}"; do
  echo "$r"
done
echo "================================"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "FAILED ($FAIL_COUNT failures, $WARN_COUNT warnings)"
  exit 1
elif [ "$WARN_COUNT" -gt 0 ]; then
  echo "ALL CHECKS PASSED ($WARN_COUNT warnings)"
  exit 0
else
  echo "ALL CHECKS PASSED"
  exit 0
fi
