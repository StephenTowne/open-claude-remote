/**
 * 依赖检测与安装入口模块
 */

import { checkDependency, checkNodeVersion } from './detector.js';
import { installWithProgress, tryFallbackInstall } from './installer.js';
import {
  promptInstall,
  showAllReady,
  showCheckStart,
  showCheckStatus,
  showManualInstallHelp,
} from './prompt.js';
import {
  detectPackageManager,
  getNodeInstallCommands,
  getPlatformHelp,
} from './platform.js';
import {
  DEPENDENCIES,
  type DependencyName,
  type EnsureDepsResult,
} from './types.js';

/**
 * 确保所有依赖已安装
 *
 * 检测顺序：Node.js → pnpm → Claude CLI
 * 如有缺失，交互式提示用户确认后自动安装
 */
export async function ensureDependencies(): Promise<EnsureDepsResult> {
  const result: EnsureDepsResult = {
    allInstalled: true,
    installed: [],
    failed: [],
  };

  showCheckStart();

  // 1. 检测 Node.js
  const nodeResult = await handleNodeDependency();
  if (!nodeResult.success) {
    result.allInstalled = false;
    result.failed.push('node');
    return result;
  }
  if (nodeResult.newlyInstalled) {
    result.installed.push('node');
  }

  // 2. 检测 pnpm
  const pnpmResult = await handlePnpmDependency();
  if (!pnpmResult.success) {
    result.allInstalled = false;
    result.failed.push('pnpm');
    return result;
  }
  if (pnpmResult.newlyInstalled) {
    result.installed.push('pnpm');
  }

  // 3. 检测 Claude CLI
  const claudeResult = await handleClaudeDependency();
  if (!claudeResult.success) {
    result.allInstalled = false;
    result.failed.push('claude');
    return result;
  }
  if (claudeResult.newlyInstalled) {
    result.installed.push('claude');
  }

  showAllReady();
  return result;
}

interface HandleResult {
  success: boolean;
  newlyInstalled: boolean;
}

/**
 * 处理 Node.js 依赖
 */
async function handleNodeDependency(): Promise<HandleResult> {
  const check = await checkDependency('node');

  if (!check.installed) {
    showCheckStatus('node', false);
    return await installNode();
  }

  // 检查版本 - 安全地处理 version 可能为 undefined 的情况
  const dep = DEPENDENCIES.node;
  const version = check.version ?? 'unknown';
  if (dep.minVersion && !checkNodeVersion(version, dep.minVersion)) {
    process.stderr.write(`  ✗ Node.js ${version} (need >= ${dep.minVersion})\n`);
    process.stderr.write(`\n[ERROR] Node.js ${dep.minVersion}+ is required. Current: ${version}\n`);
    process.stderr.write(`Please upgrade: ${dep.helpUrl}\n`);
    return { success: false, newlyInstalled: false };
  }

  showCheckStatus('node', true, check.version);
  return { success: true, newlyInstalled: false };
}

/**
 * 安装 Node.js
 */
async function installNode(): Promise<HandleResult> {
  const pkgManager = detectPackageManager();
  const installCommands = getNodeInstallCommands(pkgManager);

  if (installCommands.length === 0) {
    showManualInstallHelp('node', DEPENDENCIES.node.helpUrl);
    process.stderr.write(`\n${getPlatformHelp()}\n`);
    return { success: false, newlyInstalled: false };
  }

  const confirmed = await promptInstall({
    name: 'node',
    installCommands,
    helpUrl: DEPENDENCIES.node.helpUrl,
  });

  if (!confirmed) {
    return { success: false, newlyInstalled: false };
  }

  const installResult = await installWithProgress('node', installCommands);
  if (!installResult.success) {
    return { success: false, newlyInstalled: false };
  }

  return { success: true, newlyInstalled: true };
}

/**
 * 处理 pnpm 依赖
 */
async function handlePnpmDependency(): Promise<HandleResult> {
  const check = await checkDependency('pnpm');

  if (!check.installed) {
    showCheckStatus('pnpm', false);
    return await installPnpm();
  }

  // 检查版本 - 安全地处理 version 可能为 undefined 的情况
  const dep = DEPENDENCIES.pnpm;
  const version = check.version ?? 'unknown';
  if (dep.minVersion && !checkNodeVersion(version, dep.minVersion)) {
    process.stderr.write(`  ✗ pnpm ${version} (need >= ${dep.minVersion})\n`);
    process.stderr.write(`\n[ERROR] pnpm ${dep.minVersion}+ is required. Current: ${version}\n`);
    process.stderr.write(`Please upgrade: ${dep.helpUrl}\n`);
    return { success: false, newlyInstalled: false };
  }

  showCheckStatus('pnpm', true, check.version);
  return { success: true, newlyInstalled: false };
}

/**
 * 安装 pnpm
 */
async function installPnpm(): Promise<HandleResult> {
  const dep = DEPENDENCIES.pnpm;
  const installCommands = dep.installCommands!;

  const confirmed = await promptInstall({
    name: 'pnpm',
    installCommands,
    helpUrl: dep.helpUrl,
  });

  if (!confirmed) {
    return { success: false, newlyInstalled: false };
  }

  // 尝试主安装方式
  let installResult = await installWithProgress('pnpm', installCommands);

  // 如果失败，尝试备用方式（npm install -g pnpm）
  if (!installResult.success) {
    process.stderr.write('\n[Fallback] Trying npm install -g pnpm...\n');
    installResult = await tryFallbackInstall('pnpm');
  }

  if (!installResult.success) {
    return { success: false, newlyInstalled: false };
  }

  return { success: true, newlyInstalled: true };
}

/**
 * 处理 Claude CLI 依赖
 */
async function handleClaudeDependency(): Promise<HandleResult> {
  const check = await checkDependency('claude');

  if (!check.installed) {
    showCheckStatus('claude', false);
    return await installClaude();
  }

  showCheckStatus('claude', true, check.version);
  return { success: true, newlyInstalled: false };
}

/**
 * 安装 Claude CLI
 */
async function installClaude(): Promise<HandleResult> {
  const dep = DEPENDENCIES.claude;
  const installCommands = dep.installCommands!;

  const confirmed = await promptInstall({
    name: 'claude',
    installCommands,
    helpUrl: dep.helpUrl,
  });

  if (!confirmed) {
    return { success: false, newlyInstalled: false };
  }

  const installResult = await installWithProgress('claude', installCommands);
  if (!installResult.success) {
    return { success: false, newlyInstalled: false };
  }

  return { success: true, newlyInstalled: true };
}