/**
 * 平台检测模块
 */

import { execSync } from 'node:child_process';
import { arch as getArch, platform as getPlatform } from 'node:os';
import type { InstallCommand } from './types.js';

export type Platform = 'darwin' | 'linux' | 'win32';
export type PackageManager = 'brew' | 'apt' | 'dnf' | 'winget' | 'choco' | 'none';

/**
 * 检测当前平台
 */
export function detectPlatform(): Platform {
  return getPlatform() as Platform;
}

/**
 * 检测 CPU 架构
 */
export function detectArch(): string {
  return getArch();
}

/**
 * 检测可用的包管理器
 */
export function detectPackageManager(): PackageManager {
  const platform = detectPlatform();

  switch (platform) {
    case 'darwin':
      return detectDarwinPackageManager();
    case 'linux':
      return detectLinuxPackageManager();
    case 'win32':
      return detectWindowsPackageManager();
    default:
      return 'none';
  }
}

function detectDarwinPackageManager(): PackageManager {
  try {
    execSync('which brew', { stdio: 'ignore' });
    return 'brew';
  } catch {
    return 'none';
  }
}

function detectLinuxPackageManager(): PackageManager {
  try {
    // 使用 apt-get 而不是 apt，因为 apt 在某些系统上不是直接可执行的
    execSync('which apt-get', { stdio: 'ignore' });
    return 'apt';
  } catch {
    try {
      execSync('which dnf', { stdio: 'ignore' });
      return 'dnf';
    } catch {
      return 'none';
    }
  }
}

function detectWindowsPackageManager(): PackageManager {
  try {
    execSync('where winget', { stdio: 'ignore' });
    return 'winget';
  } catch {
    try {
      execSync('where choco', { stdio: 'ignore' });
      return 'choco';
    } catch {
      return 'none';
    }
  }
}

/**
 * 获取 Node.js 的安装命令
 */
export function getNodeInstallCommands(pkgManager: PackageManager): InstallCommand[] {
  switch (pkgManager) {
    case 'brew':
      return [
        {
          command: 'brew',
          args: ['install', 'node'],
          description: 'Install Node.js via Homebrew',
          timeout: 300000,
        },
      ];
    case 'apt':
      return [
        {
          command: 'sudo',
          args: ['apt-get', 'update'],
          description: 'Update package list',
          timeout: 120000,
        },
        {
          command: 'sudo',
          args: ['apt-get', 'install', '-y', 'nodejs', 'npm'],
          description: 'Install Node.js via apt',
          timeout: 300000,
        },
      ];
    case 'dnf':
      return [
        {
          command: 'sudo',
          args: ['dnf', 'install', '-y', 'nodejs'],
          description: 'Install Node.js via dnf',
          timeout: 300000,
        },
      ];
    case 'winget':
      return [
        {
          command: 'winget',
          args: ['install', '--id', 'OpenJS.NodeJS.LTS', '-e'],
          description: 'Install Node.js LTS via winget',
          timeout: 300000,
        },
      ];
    case 'choco':
      return [
        {
          command: 'choco',
          args: ['install', '-y', 'nodejs-lts'],
          description: 'Install Node.js LTS via Chocolatey',
          timeout: 300000,
        },
      ];
    default:
      return [];
  }
}

/**
 * 获取平台相关的帮助信息
 */
export function getPlatformHelp(): string {
  const platform = detectPlatform();
  const pkgManager = detectPackageManager();

  if (pkgManager !== 'none') {
    return '';
  }

  switch (platform) {
    case 'darwin':
      return 'Install Homebrew first: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
    case 'linux':
      return 'Install a package manager (apt, dnf) or use NodeSource: https://github.com/nodesource/distributions';
    case 'win32':
      return 'Install winget or Chocolatey, or download Node.js from https://nodejs.org/';
    default:
      return 'Visit https://nodejs.org/ to install Node.js';
  }
}