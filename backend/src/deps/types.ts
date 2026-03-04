/**
 * 依赖检测与安装模块 - 类型定义
 */

export type DependencyName = 'node' | 'pnpm' | 'claude';

export interface InstallCommand {
  command: string;
  args: string[];
  description?: string;
  timeout?: number;
}

export interface DependencyInfo {
  name: DependencyName;
  displayName: string;
  checkCommand: string;
  checkArgs: string[];
  versionRegex: RegExp;
  minVersion?: string;
  installCommands?: InstallCommand[];
  helpUrl: string;
}

export interface CheckResult {
  installed: boolean;
  version?: string;
}

export interface InstallResult {
  success: boolean;
  version?: string;
  error?: Error;
}

export interface EnsureDepsResult {
  allInstalled: boolean;
  installed: DependencyName[];
  failed: DependencyName[];
}

export const DEPENDENCIES: Record<DependencyName, DependencyInfo> = {
  node: {
    name: 'node',
    displayName: 'Node.js',
    checkCommand: 'node',
    checkArgs: ['--version'],
    versionRegex: /^v?(\d+\.\d+\.\d+)/,
    minVersion: '20',
    helpUrl: 'https://nodejs.org/',
  },
  pnpm: {
    name: 'pnpm',
    displayName: 'pnpm',
    checkCommand: 'pnpm',
    checkArgs: ['--version'],
    versionRegex: /^(\d+\.\d+\.\d+)/m,
    minVersion: '9', // required for node-linker=hoisted default
    installCommands: [
      { command: 'corepack', args: ['enable'], timeout: 10000 },
      {
        command: 'corepack',
        args: ['prepare', 'pnpm@latest', '--activate'],
        timeout: 60000,
      },
    ],
    helpUrl: 'https://pnpm.io/installation',
  },
  claude: {
    name: 'claude',
    displayName: 'Claude CLI',
    checkCommand: 'claude',
    checkArgs: ['--version'],
    versionRegex: /^(\d+\.\d+\.\d+)/m,
    installCommands: [
      {
        command: 'pnpm',
        args: ['add', '-g', '@anthropic-ai/claude-code'],
        timeout: 180000,
      },
    ],
    helpUrl: 'https://docs.anthropic.com/en/docs/claude-code',
  },
};

/**
 * 解析版本字符串的主版本号
 */
export function parseMajorVersion(version: string): number {
  const match = version.match(/^v?(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}