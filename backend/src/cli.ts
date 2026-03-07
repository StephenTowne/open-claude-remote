#!/usr/bin/env node
/**
 * claude-remote CLI entry point
 *
 * Usage:
 *   claude-remote [options] [--] [claude args...]
 *   claude-remote attach <name|id>
 *   claude-remote stop
 *
 * Options:
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

    if (options.version) {
      const { getCurrentVersion } = await import('./update.js');
      try {
        const version = getCurrentVersion();
        process.stdout.write(`claude-remote v${version}\n`);
      } catch {
        process.stdout.write('claude-remote (unknown version)\n');
      }
      process.exit(0);
    }

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

    // Handle stop subcommand
    if (options.stop) {
      const { stopDaemon } = await import('./daemon/daemon-client.js');
      await stopDaemon();
      return;
    }

    // Handle update subcommand
    if (options.update) {
      const { updatePackage } = await import('./update.js');
      await updatePackage();
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

    // Use startOrFallback: start daemon or gracefully fall back to client mode
    const { isDaemonRunning } = await import('./daemon/daemon-client.js');
    const { startOrFallback, PortInUseError } = await import('./cli-utils.js');

    const result = await startOrFallback(
      isDaemonRunning,
      // startServer thunk: lazy-load and call with CLI overrides
      async () => {
        // Fix node-pty spawn-helper permissions proactively at startup
        try {
          const { ensureSpawnHelperPermissions } = await import('./pty/fix-pty-permissions.js');
          ensureSpawnHelperPermissions();
        } catch (e) {
          const detail = e instanceof Error ? e.message : String(e);
          process.stderr.write(
            '\n[ERROR] Failed to fix node-pty permissions.\n' +
            `  Reason: ${detail}\n\n` +
            '  Try fixing manually:\n' +
            '    chmod +x node_modules/node-pty/prebuilds/*/spawn-helper\n\n'
          );
          process.exit(1);
        }

        const cliOverrides = {
          host: options.host,
          token: options.token,
          instanceName: options.name,
          claudeArgs: options.claudeArgs.length > 0 ? options.claudeArgs : undefined,
          noTerminal: options.noTerminal,
        };

        const { startServer } = await import('./index.js');
        await startServer(cliOverrides);
      },
      // attachToNewInstance thunk
      () => attachToNewInstance(options),
    );

    if (result === 'attached') {
      process.stderr.write('Daemon is running. Attached as client.\n');
    }
  } catch (err) {
    // PortInUseError means port occupied by non-daemon process (fallback retry also failed)
    const { PortInUseError } = await import('./cli-utils.js');
    if (err instanceof PortInUseError) {
      process.stderr.write(
        `\n[ERROR] Port ${err.port} is already in use by another process.\n` +
        '  If a previous daemon is stuck, find and kill it:\n' +
        `    lsof -i :${err.port}\n` +
        `    kill <PID>\n\n`
      );
      process.exit(1);
    }
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\n[ERROR] Failed to start: ${message}\n`);
    process.exit(1);
  }
})();

/**
 * When daemon is already running, create a new instance via API and WS-attach to it.
 * This provides the same terminal experience as the first instance but runs as a client.
 */
async function attachToNewInstance(options: import('./cli-utils.js').CliOptions): Promise<void> {
  const { DEFAULT_PORT } = await import('#shared');
  const { createInstance, getSharedToken } = await import('./daemon/daemon-client.js');
  const { VirtualPtyManager } = await import('./pty/virtual-pty.js');
  const { TerminalRelay } = await import('./terminal/terminal-relay.js');
  const { basename } = await import('node:path');

  const cwd = process.cwd();
  const name = options.name || basename(cwd);
  const claudeArgs = options.claudeArgs.length > 0 ? options.claudeArgs : undefined;

  // Create instance via daemon API
  let instanceId: string;
  let instanceName: string;
  try {
    const result = await createInstance({ cwd, name, claudeArgs, headless: false });
    instanceId = result.instanceId;
    instanceName = result.name;
  } catch (err) {
    process.stderr.write(`Failed to create instance: ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  }

  process.stderr.write(`Daemon is running. Created instance: ${instanceName} (${instanceId.substring(0, 8)})\n`);

  // Get shared token for WS auth
  const token = getSharedToken();

  // Create VirtualPtyManager and TerminalRelay (client mode)
  const virtualPty = new VirtualPtyManager();
  const relay = new TerminalRelay(virtualPty);

  let stopping = false;
  const cleanup = () => {
    if (stopping) return;
    stopping = true;
    relay.stop();
    virtualPty.destroy();
  };

  // PTY output → stdout
  virtualPty.on('data', (data: string) => {
    process.stdout.write(data);
  });

  // Follow server resize
  virtualPty.on('server_resize', () => {
    const cols = process.stdout.columns ?? 80;
    const rows = process.stdout.rows ?? 24;
    virtualPty.resize(cols, rows);
  });

  // Handle instance exit
  virtualPty.on('exit', (_exitCode: number) => {
    cleanup();
    process.exit(0);
  });

  virtualPty.on('error', (err: Error) => {
    process.stderr.write(`Connection error: ${err.message}\n`);
    cleanup();
    process.exit(1);
  });

  // Connect to daemon WS
  const wsUrl = `ws://localhost:${DEFAULT_PORT}/ws/${instanceId}`;
  try {
    await virtualPty.connect(wsUrl, token);
  } catch (err) {
    process.stderr.write(`Connection failed: ${err instanceof Error ? err.message : err}\n`);
    cleanup();
    process.exit(1);
  }

  // Sync terminal size
  const cols = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  virtualPty.resize(cols, rows);

  // Start terminal relay
  relay.start();

  process.stderr.write(`Connected to instance ${instanceName}. Press Ctrl+C twice to exit.\n`);

  // Wait for process exit
  await new Promise<void>((resolve) => {
    process.on('SIGINT', () => {
      cleanup();
      resolve();
    });
    process.on('SIGTERM', () => {
      cleanup();
      resolve();
    });
  });
}