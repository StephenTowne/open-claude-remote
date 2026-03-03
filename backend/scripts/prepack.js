#!/usr/bin/env node
/**
 * npm pack/publish 前自动执行
 * 功能：
 * 1. 构建 shared、frontend、backend
 * 2. 复制 shared/dist → backend/shared-dist
 * 3. 复制 frontend/dist → backend/frontend-dist
 * 4. 替换 @claude-remote/shared import 为相对路径
 * 5. 复制 README.md、LICENSE
 */

import { execSync } from 'node:child_process';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, cpSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..'); // 从 backend/scripts 往上两层到项目根目录
const backendDir = resolve(__dirname, '..'); // backend 目录

console.log('🚀 开始 prepack 处理...\n');

// 1. 构建所有包
console.log('📦 步骤 1: 构建所有包...');
execSync('pnpm --filter ./shared build', { cwd: projectRoot, stdio: 'inherit' });
execSync('pnpm --filter ./frontend build', { cwd: projectRoot, stdio: 'inherit' });
execSync('pnpm --filter ./backend build', { cwd: projectRoot, stdio: 'inherit' });
console.log('   ✅ 构建完成\n');

// 2. 复制 shared/dist → backend/shared-dist
console.log('📦 步骤 2: 复制 shared/dist → backend/shared-dist...');
const sharedDist = resolve(backendDir, 'shared-dist');
if (existsSync(sharedDist)) rmSync(sharedDist, { recursive: true });
cpSync(resolve(projectRoot, 'shared/dist'), sharedDist, { recursive: true });
console.log('   ✅ shared-dist 复制完成\n');

// 3. 复制 frontend/dist → backend/frontend-dist
console.log('📦 步骤 3: 复制 frontend/dist → backend/frontend-dist...');
const frontendDist = resolve(backendDir, 'frontend-dist');
if (existsSync(frontendDist)) rmSync(frontendDist, { recursive: true });
cpSync(resolve(projectRoot, 'frontend/dist'), frontendDist, { recursive: true });
console.log('   ✅ frontend-dist 复制完成\n');

// 4. 替换 import 路径
console.log('📦 步骤 4: 替换 @claude-remote/shared import 路径...');

function replaceImports(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      replaceImports(fullPath);
      continue;
    }
    if (!entry.name.endsWith('.js')) continue;

    let content = readFileSync(fullPath, 'utf-8');
    const originalContent = content;

    // 计算从当前文件到 shared-dist 的相对路径
    const relativePath = relative(dirname(fullPath), sharedDist).split(sep).join('/');
    const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;

    // 替换各种 import 形式
    content = content.replace(
      /from ['"]@claude-remote\/shared['"]/g,
      `from '${importPath}/index.js'`
    );
    content = content.replace(
      /from ['"]@claude-remote\/shared\/(.+?)['"]/g,
      (_, p) => `from '${importPath}/${p}.js'`
    );

    if (content !== originalContent) {
      writeFileSync(fullPath, content);
      console.log(`   📝 已处理: ${relative(resolve(backendDir, 'dist'), fullPath)}`);
    }
  }
}

replaceImports(resolve(backendDir, 'dist'));
console.log('   ✅ import 路径替换完成\n');

// 5. 复制 README.md 和 LICENSE
console.log('📦 步骤 5: 复制 README.md 和 LICENSE...');
if (existsSync(resolve(projectRoot, 'README.md'))) {
  cpSync(resolve(projectRoot, 'README.md'), resolve(backendDir, 'README.md'));
  console.log('   ✅ README.md 复制完成');
}
if (existsSync(resolve(projectRoot, 'LICENSE'))) {
  cpSync(resolve(projectRoot, 'LICENSE'), resolve(backendDir, 'LICENSE'));
  console.log('   ✅ LICENSE 复制完成');
}
console.log();

console.log('✅ Prepack 完成！\n');