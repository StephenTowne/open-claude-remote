#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# sync-opensource.sh — Sync master branch to opensource and push to GitHub
# =============================================================================

# --- Configuration -----------------------------------------------------------
INTERNAL_BRANCH="master"
OPENSOURCE_BRANCH="opensource"
GITHUB_REMOTE="github"
GITHUB_TARGET_BRANCH="main"

EXCLUDED_PATHS=(".claude/" ".claude-remote/" ".aci/" "docs/" "CLAUDE.md" "ARCHITECTURE.md" "LEGAL.md" "INDEX.md")
EXCLUSION_MARKER="# Open source exclusions"

# --- Colors ------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }

# --- Cleanup trap ------------------------------------------------------------
original_branch=""

cleanup() {
    local exit_code=$?
    if [ -n "$original_branch" ]; then
        current=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
        # Abort any in-progress merge
        if git rev-parse --verify MERGE_HEAD &>/dev/null; then
            warn "Aborting in-progress merge..."
            git merge --abort 2>/dev/null || true
        fi
        # Return to original branch if not already there
        if [ "$current" != "$original_branch" ]; then
            warn "Returning to $original_branch branch..."
            git checkout "$original_branch" 2>/dev/null || true
        fi
    fi
    if [ $exit_code -ne 0 ]; then
        error "Sync failed. You are back on $original_branch."
    fi
    exit $exit_code
}

trap cleanup EXIT

# --- Pre-flight checks -------------------------------------------------------
info "Starting opensource sync..."

# Must be on master
current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "$INTERNAL_BRANCH" ]; then
    error "Must be on '$INTERNAL_BRANCH' branch (currently on '$current_branch')."
    error "Run: git checkout $INTERNAL_BRANCH"
    exit 1
fi
original_branch="$INTERNAL_BRANCH"

# Working tree must be clean
if ! git diff --quiet || ! git diff --cached --quiet; then
    error "Working tree has uncommitted changes. Please commit or stash first."
    exit 1
fi

if [ -n "$(git ls-files --others --exclude-standard)" ]; then
    warn "Untracked files detected (ignored for sync, but consider cleaning up)."
fi

# Fetch latest from github
info "Fetching latest from $GITHUB_REMOTE..."
git fetch "$GITHUB_REMOTE"

# Check if there are commits to sync
commits_to_sync=$(git rev-list "$OPENSOURCE_BRANCH".."$INTERNAL_BRANCH" --count 2>/dev/null || echo "0")
if [ "$commits_to_sync" -eq 0 ]; then
    ok "No new commits to sync ($INTERNAL_BRANCH is up to date with $OPENSOURCE_BRANCH)."
    exit 0
fi
info "Found $commits_to_sync commit(s) to sync."

# --- Fix upstream tracking (one-time) ----------------------------------------
current_upstream=$(git rev-parse --abbrev-ref "$OPENSOURCE_BRANCH@{upstream}" 2>/dev/null || echo "")
expected_upstream="$GITHUB_REMOTE/$GITHUB_TARGET_BRANCH"

if [ "$current_upstream" != "$expected_upstream" ]; then
    warn "Fixing upstream: $OPENSOURCE_BRANCH tracks '$current_upstream', changing to '$expected_upstream'..."
    git branch --set-upstream-to="$expected_upstream" "$OPENSOURCE_BRANCH"
    ok "Upstream updated."
fi

# --- Checkout opensource ------------------------------------------------------
info "Switching to $OPENSOURCE_BRANCH branch..."
git checkout "$OPENSOURCE_BRANCH"

# --- Merge master (no-commit, no-ff) -----------------------------------------
info "Merging $INTERNAL_BRANCH into $OPENSOURCE_BRANCH..."
if ! git merge "$INTERNAL_BRANCH" --no-commit --no-ff 2>/dev/null; then
    warn "Merge has conflicts, checking if they are only in excluded files..."
fi

# --- Remove excluded files ----------------------------------------------------
info "Removing excluded internal files..."
for path in "${EXCLUDED_PATHS[@]}"; do
    if git ls-files --error-unmatch "$path" &>/dev/null 2>&1; then
        git rm -rf --quiet "$path" 2>/dev/null || true
    fi
    # Also remove from working tree if present
    rm -rf "$path" 2>/dev/null || true
done

# --- Ensure .gitignore has exclusion entries ----------------------------------
info "Ensuring .gitignore exclusion entries..."

# Resolve .gitignore conflict if present (take master version as base)
if git diff --name-only --diff-filter=U 2>/dev/null | grep -q "^\.gitignore$"; then
    git checkout --theirs .gitignore 2>/dev/null || true
    git add .gitignore
fi

# Ensure exclusion marker and entries exist
if [ -f ".gitignore" ]; then
    if ! grep -q "$EXCLUSION_MARKER" .gitignore; then
        # Add exclusion block
        # Ensure file ends with newline before appending
        [ -s .gitignore ] && [[ $(tail -c1 .gitignore) != "" ]] && echo "" >> .gitignore
        echo "" >> .gitignore
        echo "$EXCLUSION_MARKER" >> .gitignore
        for path in "${EXCLUDED_PATHS[@]}"; do
            echo "$path" >> .gitignore
        done
    else
        # Marker exists, ensure all paths are listed
        for path in "${EXCLUDED_PATHS[@]}"; do
            if ! grep -qF "$path" .gitignore; then
                echo "$path" >> .gitignore
            fi
        done
    fi
    # Ensure file ends with newline
    [ -s .gitignore ] && [[ $(tail -c1 .gitignore) != "" ]] && echo "" >> .gitignore
    git add .gitignore
fi

# --- Check for remaining code conflicts --------------------------------------
conflicted_files=$(git diff --name-only --diff-filter=U 2>/dev/null || true)
if [ -n "$conflicted_files" ]; then
    error "Merge conflicts detected in code files:"
    echo "$conflicted_files" | while read -r f; do
        echo "  - $f"
    done
    error "Please resolve conflicts manually, then re-run this script."
    # merge --abort is handled by cleanup trap
    exit 1
fi

# --- Commit and push ----------------------------------------------------------
info "Committing merge..."
git add -A
git commit -m "chore: sync master to opensource" --no-verify

merge_hash=$(git rev-parse --short HEAD)
ok "Merge committed: $merge_hash"

info "Pushing to $GITHUB_REMOTE/$GITHUB_TARGET_BRANCH..."
git push "$GITHUB_REMOTE" "$OPENSOURCE_BRANCH:$GITHUB_TARGET_BRANCH"
ok "Pushed successfully."

# --- Return to master ---------------------------------------------------------
info "Switching back to $INTERNAL_BRANCH..."
git checkout "$INTERNAL_BRANCH"

echo ""
ok "===== Sync complete! ====="
ok "Commits synced: $commits_to_sync"
ok "Merge commit:   $merge_hash"
ok "Pushed to:      $GITHUB_REMOTE/$GITHUB_TARGET_BRANCH"
