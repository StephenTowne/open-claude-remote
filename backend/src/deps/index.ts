/**
 * 依赖检测与安装入口模块
 */

import { checkDependency, checkNodeVersion, checkAllDependencies } from './detector.js';
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
 * 静默检测所有依赖（不打印任何日志）
 */
async function checkAllDependenciesSilently(): Promise<{
  results: Record<DependencyName, { installed: boolean; version?: string }>;
  allInstalled: boolean;
  missing: DependencyName[];
}> {
  const results = await checkAllDependencies();
  const missing: DependencyName[] = [];

  // 检查每个依赖是否安装且版本符合要求
  for (const name of ['node', 'pnpm', 'claude'] as DependencyName[]) {
    const result = results[name];
    const dep = DEPENDENCIES[name];

    if (!result.installed) {
      missing.push(name);
      continue;
    }

    // 检查版本是否满足最低要求
    if (dep.minVersion) {
      const version = result.version ?? 'unknown';
      if (!checkNodeVersion(version, dep.minVersion)) {
        missing.push(name);
      }
    }
  }

  return {
    results,
    allInstalled: missing.length === 0,
    missing,
  };
}

/**
 * 确保所有依赖已安装
 *
 * 检测顺序：Node.js → pnpm → Claude CLI
 * 如有缺失，交互式提示用户确认后自动安装
 *
 * 静默模式：所有依赖已安装时不打印任何日志
 */
export async function ensureDependencies(): Promise<EnsureDepsResult> {
  const result: EnsureDepsResult = {
    allInstalled: true,
    installed: [],
    failed: [],
  };

  // 1. 静默检测所有依赖
  const { results, allInstalled, missing } = await checkAllDependenciesSilently();

  // 2. 如果全部已安装，直接返回，不打印任何内容
  if (allInstalled) {
    return result;
  }

  // 3. 有缺失，显示检测日志并处理安装
  showCheckStart();

  // 重新显示已安装依赖的状态
  for (const name of ['node', 'pnpm', 'claude'] as DependencyName[]) {
    const checkResult = results[name];
    if (!missing.includes(name)) {
      showCheckStatus(name, true, checkResult.version);
    }
  }

  // 4. 按顺序处理缺失的依赖
  for (const name of missing) {
    let handleResult: HandleResult;

    switch (name) {
      case 'node':
        handleResult = await handleNodeDependency(results.node);
        break;
      case 'pnpm':
        handleResult = await handlePnpmDependency(results.pnpm);
        break;
      case 'claude':
        handleResult = await handleClaudeDependency(results.claude);
        break;
    }

    if (!handleResult.success) {
      result.allInstalled = false;
      result.failed.push(name);
      return result;
    }
    if (handleResult.newlyInstalled) {
      result.installed.push(name);
    }
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
async function handleNodeDependency(
  preCheck?: { installed: boolean; version?: string }
): Promise<HandleResult> {
  const check = preCheck ?? await checkDependency('node');

  if (!check.installed) {
    showCheckStatus('node', false);
    return await installNode();
  }

  // 检查版本 - 安全地处理 version 可能为 undefined 的情况
  const dep = DEPENDENCIES.node;
  const version = check.version ?? 'unknown';
  if (dep.minVersion && !checkNodeVersion(version, dep.minVersion)) {
    showCheckStatus('node', false);
    process.stderr.write(`  ✗ Node.js ${version} (need >= ${dep.minVersion})\n`);
    process.stderr.write(`\n[ERROR] Node.js ${dep.minVersion}+ is required. Current: ${version}\n`);
    process.stderr.write(`Please upgrade: ${dep.helpUrl}\n`);
    return { success: false, newlyInstalled: false };
  }

  // 已安装且版本符合，不打印（已在 ensureDependencies 中统一打印）
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
async function handlePnpmDependency(
  preCheck?: { installed: boolean; version?: string }
): Promise<HandleResult> {
  const check = preCheck ?? await checkDependency('pnpm');

  if (!check.installed) {
    showCheckStatus('pnpm', false);
    return await installPnpm();
  }

  // 检查版本 - 安全地处理 version 可能为 undefined 的情况
  const dep = DEPENDENCIES.pnpm;
  const version = check.version ?? 'unknown';
  if (dep.minVersion && !checkNodeVersion(version, dep.minVersion)) {
    showCheckStatus('pnpm', false);
    process.stderr.write(`  ✗ pnpm ${version} (need >= ${dep.minVersion})\n`);
    process.stderr.write(`\n[ERROR] pnpm ${dep.minVersion}+ is required. Current: ${version}\n`);
    process.stderr.write(`Please upgrade: ${dep.helpUrl}\n`);
    return { success: false, newlyInstalled: false };
  }

  // 已安装且版本符合，不打印（已在 ensureDependencies 中统一打印）
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
async function handleClaudeDependency(
  preCheck?: { installed: boolean; version?: string }
): Promise<HandleResult> {
  const check = preCheck ?? await checkDependency('claude');

  if (!check.installed) {
    showCheckStatus('claude', false);
    return await installClaude();
  }

  // 已安装，不打印（已在 ensureDependencies 中统一打印）
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