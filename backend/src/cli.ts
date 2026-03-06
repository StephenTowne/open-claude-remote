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
  try {
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

    // Only check Claude CLI — the sole runtime dependency for npm users
    const { checkDependency } = await import('./deps/detector.js');
    const claudeCheck = await checkDependency('claude');
    if (!claudeCheck.installed) {
      process.stderr.write(
        '\n[ERROR] Claude CLI is not installed.\n\n' +
        'Install it with:\n' +
        '  npm install -g @anthropic-ai/claude-code\n\n' +
        'For more info: https://docs.anthropic.com/en/docs/claude-code\n'
      );
      process.exit(1);
    }

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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\n[ERROR] Failed to start: ${message}\n`);
    process.exit(1);
  }
})();