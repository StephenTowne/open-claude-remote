#!/usr/bin/env node
/**
 * 复制前端构建产物到 backend/frontend-dist
 * 用于开发模式和构建时统一路径
 */

import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../frontend/dist');
const dest = resolve(__dirname, '../backend/frontend-dist');

if (existsSync(dest)) rmSync(dest, { recursive: true });
if (existsSync(src)) {
  cpSync(src, dest, { recursive: true });
  console.log('✅ Copied frontend/dist → backend/frontend-dist');
} else {
  console.log('⚠️  frontend/dist not found, skipping copy');
}