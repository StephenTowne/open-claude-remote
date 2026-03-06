/**
 * 依赖检测模块
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  DEPENDENCIES,
  type CheckResult,
  type DependencyName,
  parseMajorVersion,
} from './types.js';

const execFileAsync = promisify(execFile);

/**
 * 检测单个依赖是否已安装
 * 使用 execFile 避免命令拼接的安全风险
 */
export async function checkDependency(name: DependencyName): Promise<CheckResult> {
  const dep = DEPENDENCIES[name];

  try {
    const { stdout } = await execFileAsync(dep.checkCommand, dep.checkArgs, {
      timeout: 5000,
    });

    const output = stdout.trim();
    const match = output.match(dep.versionRegex);

    if (match) {
      return { installed: true, version: match[1] };
    }

    // 版本格式不匹配，但命令执行成功，认为已安装
    return { installed: true, version: output.split('\n')[0] };
  } catch {
    return { installed: false };
  }
}

/**
 * 检测 Node.js 版本是否满足最低要求
 */
export function checkNodeVersion(version: string, minVersion: string): boolean {
  const major = parseMajorVersion(version);
  const minMajor = parseMajorVersion(minVersion);
  return major >= minMajor;
}

/**
 * 检测所有依赖的状态
 */
export async function checkAllDependencies(): Promise<
  Record<DependencyName, CheckResult>
> {
  const results: Record<DependencyName, CheckResult> = {
    node: await checkDependency('node'),
    pnpm: await checkDependency('pnpm'),
    claude: await checkDependency('claude'),
  };

  return results;
}