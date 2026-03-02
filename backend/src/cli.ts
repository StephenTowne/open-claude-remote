#!/usr/bin/env node
/**
 * claude-remote CLI entry point
 *
 * 用法：
 *   claude-remote [options] [--] [claude args...]
 *
 * 代理层选项：
 *   --port <number>      服务端口 (默认: 3000, 被占用时自动递增)
 *   --host <ip>          绑定地址 (默认: 自动检测 LAN IP)
 *   --token <string>     认证 Token (默认: 共享 Token)
 *   --name <string>      实例名称 (默认: 工作目录名)
 *   --help, -h           显示帮助信息
 *
 * 其他所有参数透传给 claude 命令。
 */
import { fileURLToPath } from 'node:url';
import type { CliOverrides } from './config.js';
import { startServer } from './index.js';

export interface CliOptions {
  port?: number;
  host?: string;
  token?: string;
  name?: string;
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
    } else if (arg === '--name') {
      options.name = argv[++i];
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
    } else if (arg.startsWith('--name=')) {
      options.name = arg.split('=')[1];
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
  --port <number>      服务端口 (默认: 3000, 被占用时自动递增)
  --host <ip>          绑定地址 (默认: 自动检测 LAN IP)
  --token <string>     认证 Token (默认: 共享 Token)
  --name <string>      实例名称 (默认: 工作目录名)
  --help, -h           显示帮助信息

配置文件：
  ~/.claude-remote/config.json  用户配置文件 (JSON 格式)

  可配置项：
    port            服务端口
    host            绑定地址
    token           固定 Token (覆盖共享 Token)
    instanceName    实例名称
    claudeCommand   Claude CLI 命令路径 (默认: claude)
    claudeCwd       Claude 工作目录 (默认: 当前目录)
    claudeArgs      Claude CLI 额外参数 (数组)
    maxBufferLines  输出缓冲区行数 (默认: 10000)

示例：
  claude-remote                    # 启动 Claude Code
  claude-remote chat               # 启动 Claude Code 并进入 chat 模式
  claude-remote --port 8080        # 使用端口 8080
  claude-remote --name api         # 自定义实例名称
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

  // Set CLI mode flag for clean output
  process.env.CLI_MODE = 'true';

  // Build CLI overrides for config
  const cliOverrides: CliOverrides = {
    port: options.port,
    host: options.host,
    token: options.token,
    instanceName: options.name,
    claudeArgs: options.claudeArgs.length > 0 ? options.claudeArgs : undefined,
  };

  // Start server directly (no spawn)
  await startServer(cliOverrides);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
}