#!/usr/bin/env bash
set -euo pipefail

# Legacy shim: keep script entry for compatibility, delegate to multi-instance stop.
pnpm --filter backend exec tsx src/registry/stop-instances.ts
