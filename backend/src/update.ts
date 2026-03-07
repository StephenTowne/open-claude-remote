/**
 * claude-remote update 命令实现
 *
 * 自动检测包管理器（npm/pnpm）并执行全局更新。
 */
import { realpathSync, existsSync, readFileSync } from 'node:fs';
import { get } from 'node:https';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './logger/logger.js';

const PKG_NAME = '@caoruhua/open-claude-remote';

/** 通过二进制真实路径检测安装所用的包管理器 */
export function detectPackageManager(): 'npm' | 'pnpm' {
  try {
    const realPath = realpathSync(process.argv[1]);
    if (realPath.includes('/pnpm/') || realPath.includes('/pnpm-global/')) {
      return 'pnpm';
    }
    return 'npm';
  } catch {
    return 'npm';
  }
}

/** 从 npm registry 获取最新版本号 */
export function fetchLatestVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = get(`https://registry.npmjs.org/${PKG_NAME}/latest`, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`npm registry returned status ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        try {
          const json = JSON.parse(data) as { version: string };
          resolve(json.version);
        } catch (err) {
          reject(new Error(`Failed to parse registry response: ${(err as Error).message}`));
        }
      });
    });

    req.on('error', (err: Error) => reject(err));
    req.setTimeout(10_000, () => {
      req.destroy(new Error('Request timed out (10s)'));
    });
  });
}

/** 进程级版本缓存 — 版本在进程生命周期内不会变化 */
let cachedVersion: string | null = null;

/** 从 import.meta.url 向上查找项目 package.json 获取当前版本 */
export function getCurrentVersion(): string {
  if (cachedVersion) return cachedVersion;

  // 从当前文件向上逐级查找 package.json
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    const pkgPath = resolve(dir, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { name?: string; version?: string };
      if (pkg.name === PKG_NAME && pkg.version) {
        cachedVersion = pkg.version;
        return pkg.version;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break; // 已到根目录
    dir = parent;
  }
  throw new Error(`Cannot find ${PKG_NAME} package.json`);
}

/** 简单 semver 比较：latest 是否比 current 更新 */
export function isNewerVersion(latest: string, current: string): boolean {
  const [lMajor, lMinor, lPatch] = latest.split('.').map(Number);
  const [cMajor, cMinor, cPatch] = current.split('.').map(Number);

  if (lMajor !== cMajor) return lMajor > cMajor;
  if (lMinor !== cMinor) return lMinor > cMinor;
  return lPatch > cPatch;
}

/** 执行更新的主函数 */
export async function updatePackage(): Promise<void> {
  // 1. 获取当前版本
  let currentVersion: string;
  try {
    currentVersion = getCurrentVersion();
    process.stdout.write(`Current version: ${currentVersion}\n`);
  } catch (err) {
    logger.error({ err }, 'Failed to get current version');
    process.stdout.write(`\n[ERROR] Cannot determine current version.\n`);
    return process.exit(1);
  }

  // 2. 查询最新版本
  process.stdout.write('Checking for updates...\n');
  let latestVersion: string;
  try {
    latestVersion = await fetchLatestVersion();
  } catch (err) {
    logger.error({ err }, 'Failed to fetch latest version from npm registry');
    process.stdout.write(`\n[ERROR] Cannot check for updates. Please verify your network connection.\n`);
    return process.exit(1);
  }

  // 3. 版本比较
  if (!isNewerVersion(latestVersion, currentVersion)) {
    process.stdout.write(`Already up to date (${currentVersion}).\n`);
    return process.exit(0);
  }

  // 4. 有新版本
  process.stdout.write(`New version available: ${currentVersion} → ${latestVersion}\n`);

  // 5. 检测包管理器
  const pm = detectPackageManager();
  const args = pm === 'pnpm'
    ? ['add', '-g', `${PKG_NAME}@latest`]
    : ['install', '-g', `${PKG_NAME}@latest`];

  process.stdout.write(`Updating via ${pm}...\n\n`);
  logger.info({ pm, currentVersion, latestVersion }, 'Starting package update');

  // 6. 执行更新命令
  const child = spawn(pm, args, { stdio: 'inherit' });

  // 2 分钟超时保护
  const timeout = setTimeout(() => {
    child.kill();
    process.stdout.write(`\n[ERROR] Update timed out. Please run manually:\n  ${pm} ${args.join(' ')}\n`);
    process.exit(1);
  }, 120_000);

  return new Promise<void>((promiseResolve) => {
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        process.stdout.write(`\nSuccessfully updated to ${latestVersion}!\n`);
        logger.info({ latestVersion }, 'Package updated successfully');

        // 检查 daemon 是否需要重启
        handlePostUpdateRestart().then(() => {
          promiseResolve();
        });
      } else {
        const manualCmd = `${pm} ${args.join(' ')}`;
        process.stdout.write(`\n[ERROR] Update failed (exit code ${code}). Please run manually:\n  ${manualCmd}\n`);
        logger.error({ exitCode: code, pm }, 'Package update failed');
        promiseResolve();
        process.exit(1);
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      const manualCmd = `${pm} ${args.join(' ')}`;
      process.stdout.write(`\n[ERROR] Failed to run ${pm}: ${err.message}\nPlease run manually:\n  ${manualCmd}\n`);
      logger.error({ err, pm }, 'Failed to spawn package manager');
      promiseResolve();
      process.exit(1);
    });
  });
}

/**
 * 更新完成后检查并重启 daemon
 */
async function handlePostUpdateRestart(): Promise<void> {
  try {
    const { checkDaemonVersion, smartRestartDaemon, listInstances, isDaemonRunning } = await import('./daemon/daemon-client.js');

    // 检查 daemon 是否运行
    if (!(await isDaemonRunning())) {
      return; // daemon 未运行，无需重启
    }

    // 检查版本
    const versionCheck = await checkDaemonVersion();

    if (!versionCheck.needsRestart) {
      return; // 版本匹配，无需重启
    }

    // 版本不匹配，尝试重启
    const instances = await listInstances().catch(() => []);

    if (instances.length === 0) {
      process.stdout.write('\nRestarting daemon with new version...\n');
      const result = await smartRestartDaemon();

      if (result.restarted) {
        process.stdout.write('✅ Daemon restarted.\n');
      } else {
        process.stdout.write('⚠️  Failed to restart daemon. Run manually: claude-remote stop && claude-remote\n');
      }
    } else {
      process.stdout.write('\n⚠️  Daemon is still running old version.\n');
      process.stdout.write('   Restart manually: claude-remote stop && claude-remote\n');
    }
  } catch (err) {
    // 不影响更新流程，静默失败
    logger.debug({ err }, 'Post-update daemon restart check failed');
  }
}
