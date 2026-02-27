#!/usr/bin/env bash
# Gracefully stop claude-code-remote by sending SIGTERM to the process tree.
#
# When running via `pnpm dev`, the process tree looks like:
#   concurrently → pnpm → tsx watch → node (app.pid)
# Killing only the node process leaves tsx watch hanging (it waits for file changes).
# So we walk up the tree to find the topmost process below the user's shell,
# and kill THAT — which cascades SIGTERM down the entire tree.
set -euo pipefail

PID_FILE="./logs/app.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "PID file not found: $PID_FILE (is the server running?)"
  exit 1
fi

PID=$(cat "$PID_FILE")

if ! kill -0 "$PID" 2>/dev/null; then
  echo "Process $PID not running, removing stale PID file"
  rm -f "$PID_FILE"
  exit 1
fi

# Walk up from the backend node process to find the topmost ancestor
# below the user's shell. This is typically `concurrently` (pnpm dev)
# or the node process itself (pnpm start).
find_top_ancestor() {
  local current=$1
  local top=$current

  while true; do
    local ppid
    ppid=$(ps -o ppid= -p "$current" 2>/dev/null | tr -d ' ')
    [ -z "$ppid" ] || [ "$ppid" = "1" ] || [ "$ppid" = "0" ] && break

    local cmd
    cmd=$(ps -o comm= -p "$ppid" 2>/dev/null || true)
    # Stop at shell / terminal / init boundaries
    case "$cmd" in
      zsh|bash|fish|sh|login|iTerm2|Terminal|tmux*|screen*) break ;;
    esac

    top=$ppid
    current=$ppid
  done

  echo "$top"
}

TOP_PID=$(find_top_ancestor "$PID")

if [ "$TOP_PID" = "$PID" ]; then
  echo "Sending SIGTERM to process $PID..."
else
  echo "Sending SIGTERM to process tree (top: $TOP_PID, backend: $PID)..."
fi

kill "$TOP_PID"

# Wait up to 5 seconds for graceful shutdown
for i in $(seq 1 10); do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "Server stopped."
    rm -f "$PID_FILE"
    exit 0
  fi
  sleep 0.5
done

echo "Process still running after 5s, sending SIGKILL..."
kill -9 "$TOP_PID" 2>/dev/null || true
kill -9 "$PID" 2>/dev/null || true
rm -f "$PID_FILE"
echo "Server killed."
