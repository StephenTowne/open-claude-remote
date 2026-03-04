/**
 * 依赖安装模块 - 实时输出安装进度
 */

import { spawn } from 'node:child_process';
import { checkDependency } from './detector.js';
import {
  DEPENDENCIES,
  type DependencyName,
  type InstallCommand,
  type InstallResult,
} from './types.js';
import { showCommand, showInstallStart, showStepFailure, showStepSuccess } from './prompt.js';

/**
 * 执行安装命令，实时输出进度
 */
export async function installWithProgress(
  name: DependencyName,
  commands: InstallCommand[]
): Promise<InstallResult> {
  showInstallStart(name);

  // 跟踪是否有任意一个命令成功
  let anySuccess = false;

  for (const cmd of commands) {
    showCommand(cmd.command, cmd.args);

    const result = await runCommand(cmd);

    if (result.success) {
      showStepSuccess();
      anySuccess = true;
    } else {
      showStepFailure(result.error ?? '');
      // 继续尝试下一个命令（如 corepack 失败后尝试 npm install -g pnpm）
    }
  }

  // Retry verification to allow PATH propagation after install
  let check: Awaited<ReturnType<typeof checkDependency>> = { installed: false };
  for (let attempt = 0; attempt < 3; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    check = await checkDependency(name);
    if (check.installed) break;
  }

  if (check.installed) {
    showStepSuccess(`${DEPENDENCIES[name].displayName} ${check.version} installed`);
    return { success: true, version: check.version };
  }

  if (anySuccess) {
    // 命令执行成功但验证失败，可能需要重启终端
    return {
      success: false,
      error: new Error(
        'Installation succeeded but verification failed. You may need to restart your terminal.'
      ),
    };
  }

  return { success: false, error: new Error('All install commands failed') };
}

/**
 * 运行单个命令
 * 注意：不使用 spawn 的 timeout 选项，因为 Node.js < 20.6.0 不支持
 */
async function runCommand(
  cmd: InstallCommand
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const timeout = cmd.timeout ?? 120000;
    let timedOut = false;

    // Windows 上需要 shell 来找到命令（如 winget）
    // 但 args 是硬编码的，不存在注入风险
    const proc = spawn(cmd.command, cmd.args, {
      stdio: 'inherit', // 实时输出到终端
      shell: process.platform === 'win32',
    });

    // 手动实现超时（兼容 Node.js < 20.6.0）
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({ success: false, error: 'Timeout' });
      } else {
        resolve({ success: code === 0 });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * 尝试使用备用安装方法（降级）
 */
export async function tryFallbackInstall(
  name: DependencyName
): Promise<InstallResult> {
  const dep = DEPENDENCIES[name];

  if (name === 'pnpm') {
    // pnpm 备用方案：使用 npm 安装
    showInstallStart(name);
    showCommand('npm', ['install', '-g', 'pnpm@latest']);

    const result = await runCommand({
      command: 'npm',
      args: ['install', '-g', 'pnpm@latest'],
      timeout: 60000,
    });

    if (result.success) {
      showStepSuccess();
    } else {
      showStepFailure(result.error);
    }

    // 验证安装
    await new Promise((r) => setTimeout(r, 500));
    const check = await checkDependency(name);

    if (check.installed) {
      showStepSuccess(`pnpm ${check.version} installed`);
      return { success: true, version: check.version };
    }

    return { success: false, error: new Error('Fallback install failed') };
  }

  return { success: false, error: new Error('No fallback available') };
}