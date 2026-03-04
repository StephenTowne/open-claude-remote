/**
 * 交互式确认模块
 */

import * as readline from 'node:readline';
import { DEPENDENCIES, type DependencyName, type InstallCommand } from './types.js';

export interface PromptOptions {
  name: DependencyName;
  installCommands: InstallCommand[];
  helpUrl: string;
}

/**
 * 显示安装确认提示
 * @returns true 表示用户确认安装，false 表示取消
 */
export async function promptInstall(options: PromptOptions): Promise<boolean> {
  const dep = DEPENDENCIES[options.name];

  // 无 TTY 时自动确认（CI 环境）
  if (!process.stdin.isTTY) {
    return true;
  }

  // 构建提示内容
  const lines = [
    `${dep.displayName} is required but not installed.`,
    '',
    'Install method:',
  ];

  for (const cmd of options.installCommands) {
    lines.push(`  ${cmd.command} ${cmd.args.join(' ')}`);
  }

  lines.push('');
  lines.push(`Press Enter to install, or Ctrl+C to cancel:`);

  // 计算边框宽度
  const maxLineLength = Math.max(...lines.map((l) => l.length));
  const boxWidth = maxLineLength + 4;
  const border = '─'.repeat(boxWidth);

  // 输出提示框
  process.stderr.write(`\n┌${border}┐\n`);
  for (const line of lines) {
    process.stderr.write(`│ ${line.padEnd(boxWidth - 2)} │\n`);
  }
  process.stderr.write(`└${border}┘\n`);

  // 等待用户按 Enter 或 Ctrl+C
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    // 处理 Ctrl+C (SIGINT)
    const handleSigint = () => {
      rl.close();
      process.stderr.write('\nInstallation cancelled.\n');
      resolve(false);
    };

    process.once('SIGINT', handleSigint);

    rl.question('', () => {
      process.off('SIGINT', handleSigint);
      rl.close();
      resolve(true); // Enter 继续安装
    });

    // 处理 readline 关闭事件（用户按 Ctrl+D 等）
    rl.on('close', () => {
      process.off('SIGINT', handleSigint);
      // readline closed without question callback (e.g. Ctrl+D / EOF)
      resolve(false);
    });
  });
}

/**
 * 显示安装失败提示，提供手动安装帮助
 */
export function showManualInstallHelp(
  name: DependencyName,
  helpUrl: string
): void {
  const dep = DEPENDENCIES[name];
  process.stderr.write(`\n[ERROR] Cannot auto-install ${dep.displayName} on this system.\n`);
  process.stderr.write(`Please install manually: ${helpUrl}\n`);
}

/**
 * 显示安装开始信息
 */
export function showInstallStart(name: DependencyName): void {
  const dep = DEPENDENCIES[name];
  process.stderr.write(`\n[Installing ${dep.displayName}...]\n`);
}

/**
 * 显示命令执行信息
 */
export function showCommand(cmd: string, args: string[]): void {
  process.stderr.write(`> ${cmd} ${args.join(' ')}\n`);
}

/**
 * 显示步骤成功
 */
export function showStepSuccess(message: string = 'Done'): void {
  process.stderr.write(`  ✓ ${message}\n`);
}

/**
 * 显示步骤失败
 */
export function showStepFailure(message: string = 'Failed'): void {
  process.stderr.write(`  ✗ ${message}\n`);
}

/**
 * 显示检测状态
 */
export function showCheckStatus(
  name: DependencyName,
  installed: boolean,
  version?: string
): void {
  const dep = DEPENDENCIES[name];
  if (installed) {
    process.stderr.write(`  ✓ ${dep.displayName} ${version ?? 'installed'}\n`);
  } else {
    process.stderr.write(`  ✗ ${dep.displayName} not found\n`);
  }
}

/**
 * 显示依赖检测开始
 */
export function showCheckStart(): void {
  process.stderr.write('Checking dependencies...\n');
}

/**
 * 显示所有依赖就绪
 */
export function showAllReady(): void {
  process.stderr.write('\nAll dependencies ready. Starting server...\n\n');
}

/**
 * 显示依赖安装失败
 */
export function showInstallFailed(failed: DependencyName[]): void {
  process.stderr.write('\n[ERROR] Failed to install required dependencies.\n');
  process.stderr.write('Please install manually and try again.\n');
  process.stderr.write(`Missing: ${failed.join(', ')}\n`);
}