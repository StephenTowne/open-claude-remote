#!/usr/bin/env node
/**
 * claude-remote CLI entry point
 *
 * 用法：
 *   claude-remote [options] [--] [claude args...]
 *   claude-remote attach <port|name>
 *
 * 代理层选项：
 *   --port <number>      服务端口 (默认: 3000, 被占用时自动递增)
 *   --host <ip>          绑定地址 (默认: 自动检测 LAN IP)
 *   --token <string>     认证 Token (默认: 共享 Token)
 *   --name <string>      实例名称 (默认: 工作目录名)
 *   --help, -h           显示帮助信息
 *
 * 其他所有参数透传给 claude 命令。
 *
 * 注意：此文件不能有任何静态 import，因为 ESM 会提升它们到模块顶部执行，
 * 导致 CLI_MODE 设置在 logger 模块加载之后才生效。
 */

// 必须在任何模块加载之前设置 CLI_MODE，因为 logger.ts 在模块顶层读取此变量
process.env.CLI_MODE = 'true';

// 所有模块必须使用动态 import
void (async () => {
  const { fileURLToPath } = await import('node:url');

  const { parseCliArgs, showHelp } = await import('./cli-utils.js');

  const options = parseCliArgs(process.argv);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // 处理 attach 子命令
  if (options.attach) {
    const { attachInstance } = await import('./attach.js');
    await attachInstance({ target: options.attach });
    return;
  }

  // Set NO_TERMINAL flag for headless mode
  if (options.noTerminal) {
    process.env.NO_TERMINAL = 'true';
  }

  // 动态导入 CliOverrides 类型（仅类型，编译后会移除）
  const { loadConfig, createSessionCookieName } = await import('./config.js');

  // Build CLI overrides for config
  const cliOverrides = {
    port: options.port,
    host: options.host,
    token: options.token,
    instanceName: options.name,
    claudeArgs: options.claudeArgs.length > 0 ? options.claudeArgs : undefined,
    noTerminal: options.noTerminal,
  };

  // 动态加载 startServer
  const { startServer } = await import('./index.js');
  await startServer(cliOverrides);
})();