#!/bin/bash
# Start development servers (backend + frontend)
set -e

cd "$(dirname "$0")/.."

echo "Building shared package..."
pnpm --filter @claude-remote/shared build

echo "Starting dev servers..."
pnpm dev
