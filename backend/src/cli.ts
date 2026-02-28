#!/usr/bin/env node
/**
 * claude-remote CLI entry point
 *
 * 用法：
 *   claude-remote [options] [--] [claude args...]
 *
 * 代理层选项：
 *   --port <number>      服务端口 (默认: 3000)
 *   --host <ip>          绑定地址 (默认: 自动检测 LAN IP)
 *   --token <string>     认证 Token (默认: 随机生成)
 *   --help, -h           显示帮助信息
 *
 * 其他所有参数透传给 claude 命令。
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

export interface CliOptions {
  port?: number;
  host?: string;
  token?: string;
  help: boolean;
  claudeArgs: string[];
}

function parsePort(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error('--port requires a numeric value');
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('--port must be between 1 and 65535');
  }
  return port;
}

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    help: false,
    claudeArgs: [],
  };

  let i = 2; // Skip 'node' and script path
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      i++;
    } else if (arg === '--port') {
      options.port = parsePort(argv[++i]);
      i++;
    } else if (arg === '--host') {
      options.host = argv[++i];
      i++;
    } else if (arg === '--token') {
      options.token = argv[++i];
      i++;
    } else if (arg === '--') {
      // Stop parsing, pass all remaining args to claude
      options.claudeArgs.push(...argv.slice(i + 1));
      break;
    } else if (arg.startsWith('--port=')) {
      options.port = parsePort(arg.split('=')[1]);
      i++;
    } else if (arg.startsWith('--host=')) {
      options.host = arg.split('=')[1];
      i++;
    } else if (arg.startsWith('--token=')) {
      options.token = arg.split('=')[1];
      i++;
    } else {
      // Unknown arg: pass to claude
      options.claudeArgs.push(arg);
      i++;
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
Claude Code Remote - 在局域网内通过手机远程控制 Claude Code

用法：
  claude-remote [options] [--] [claude args...]

代理层选项：
  --port <number>      服务端口 (默认: 3000)
  --host <ip>          绑定地址 (默认: 自动检测 LAN IP)
  --token <string>     认证 Token (默认: 随机生成)
  --help, -h           显示帮助信息

环境变量：
  PORT                 服务端口
  HOST                 绑定地址
  AUTH_TOKEN           固定 Token
  CLAUDE_COMMAND       Claude CLI 命令路径 (默认: claude)
  CLAUDE_CWD           Claude 工作目录 (默认: 当前目录)
  MAX_BUFFER_LINES     输出缓冲区行数 (默认: 10000)

示例：
  claude-remote                    # 启动 Claude Code
  claude-remote chat               # 启动 Claude Code 并进入 chat 模式
  claude-remote --port 8080        # 使用端口 8080
  claude-remote -- --dangerously-skip-permissions  # 透传参数给 claude

更多 Claude Code 选项请运行：claude --help
`);
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const options = parseCliArgs(argv);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Set environment variables for the main process
  process.env.CLI_MODE = 'true';  // Enable clean CLI experience
  if (options.port !== undefined) {
    process.env.PORT = String(options.port);
  }
  if (options.host !== undefined) {
    process.env.HOST = options.host;
  }
  if (options.token !== undefined) {
    process.env.AUTH_TOKEN = options.token;
  }
  if (options.claudeArgs.length > 0) {
    process.env.CLAUDE_ARGS = JSON.stringify(options.claudeArgs);
  }

  // Resolve main entry path
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const mainPath = resolve(__dirname, 'index.js');

  if (!existsSync(mainPath)) {
    console.error('Error: Backend not built. Run `pnpm build` first.');
    process.exit(1);
  }

  // Spawn the main process with inherited stdio
  // This gives the exact terminal experience as running claude directly
  const child = spawn(process.execPath, [mainPath], {
    stdio: 'inherit',
    env: process.env,
  });

  // Forward exit codes
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });

  // Forward signals
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
}