#!/bin/bash
# Production build
set -e

cd "$(dirname "$0")/.."

echo "Installing dependencies..."
pnpm install

echo "Building shared package..."
pnpm --filter @claude-remote/shared build

echo "Building frontend..."
pnpm --filter @claude-remote/frontend build

echo "Building backend..."
pnpm --filter @claude-remote/backend build

echo ""
echo "Build complete! Run with:"
echo "  node backend/dist/index.js"
