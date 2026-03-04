#!/usr/bin/env node
/**
 * claude-remote CLI entry point
 *
 * Usage:
 *   claude-remote [options] [--] [claude args...]
 *   claude-remote attach <port|name>
 *
 * Options:
 *   --port <number>      Server port (default: 3000, auto-increments if busy)
 *   --host <ip>          Bind address (default: auto-detect LAN IP)
 *   --token <string>     Auth token (default: shared token)
 *   --name <string>      Instance name (default: working directory name)
 *   --help, -h           Show help
 *
 * All other arguments are passed through to the claude command.
 *
 * Note: This file must not have any static imports because ESM hoists them
 * to execute at module top-level, which would cause CLI_MODE to be set
 * after the logger module has already loaded.
 */

// Must set CLI_MODE before any module loads, as logger.ts reads it at module top-level
process.env.CLI_MODE = 'true';

// All modules must use dynamic import
void (async () => {
  const { parseCliArgs, showHelp } = await import('./cli-utils.js');

  const options = parseCliArgs(process.argv);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Handle attach subcommand
  if (options.attach) {
    const { attachInstance } = await import('./attach.js');
    await attachInstance({ target: options.attach });
    return;
  }

  // Set NO_TERMINAL flag for headless mode
  if (options.noTerminal) {
    process.env.NO_TERMINAL = 'true';
  }

  // Detect and install missing dependencies (pnpm, claude CLI, etc.)
  const { ensureDependencies } = await import('./deps/index.js');
  const depsResult = await ensureDependencies();
  if (!depsResult.allInstalled) {
    process.exit(1);
  }

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

  // Dynamically load startServer
  const { startServer } = await import('./index.js');
  await startServer(cliOverrides);
})();