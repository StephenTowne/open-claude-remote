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

    // Handle list subcommand
    if (options.list) {
      await handleListCommand();
      return;
    }

    // Handle status subcommand
    if (options.status) {
      await handleStatusCommand();
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

    // Ensure daemon is running, then attach as client
    const { isDaemonRunning, checkDaemonVersion, smartRestartDaemon } = await import('./daemon/daemon-client.js');
    const { launchDaemon } = await import('./daemon/daemon-launcher.js');
    const { DEFAULT_PORT } = await import('#shared');

    let daemonPid: number | undefined;

    if (!(await isDaemonRunning())) {
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

      // Launch daemon as a detached subprocess
      const cliOverrides = {
        host: options.host,
        token: options.token,
        instanceName: options.name,
        claudeArgs: options.claudeArgs.length > 0 ? options.claudeArgs : undefined,
        noTerminal: options.noTerminal,
      };

      const result = await launchDaemon(cliOverrides);
      daemonPid = result.pid;
      process.stderr.write(`Daemon started (PID: ${daemonPid}).\n`);
    } else {
      // Daemon already running - check version compatibility
      const versionCheck = await checkDaemonVersion();

      if (versionCheck.needsRestart) {
        process.stderr.write(`Daemon version outdated: ${versionCheck.daemonVersion} → ${versionCheck.cliVersion}\n`);

        const result = await smartRestartDaemon();

        if (result.restarted) {
          process.stderr.write('Daemon restarted with latest version.\n');
          // After restart, daemon PID needs to be fetched from status API
        } else if (result.reason === 'has_instances') {
          process.stderr.write('\n⚠️  Daemon has running instances. Restart manually with:\n');
          process.stderr.write('   claude-remote stop && claude-remote\n\n');
        } else if (result.reason === 'stop_failed') {
          process.stderr.write('\n⚠️  Failed to stop daemon. Please restart manually:\n');
          process.stderr.write('   claude-remote stop && claude-remote\n\n');
        }
      }
    }

    // Get config and daemon PID for banner display
    const { getDaemonStatus } = await import('./daemon/daemon-client.js');
    const { loadConfig } = await import('./config.js');
    const config = loadConfig({
      host: options.host,
      token: options.token,
      instanceName: options.name,
    });

    // Get daemon PID (from launch result or from status API)
    if (!daemonPid) {
      try {
        const status = await getDaemonStatus();
        daemonPid = status.pid;
      } catch { /* ignore */ }
    }

    // Attach as client (create instance + WS connect)
    // Returns instance info for banner display
    await attachToNewInstance(options, {
      config,
      daemonPid: daemonPid ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\n[ERROR] Failed to start: ${message}\n`);
    process.exit(1);
  }
})();

/**
 * When daemon is already running, create a new instance via API and WS-attach to it.
 * This provides the same terminal experience as the first instance but runs as a client.
 */
async function attachToNewInstance(
  options: import('./cli-utils.js').CliOptions,
  context: {
    config: import('./config.js').AppConfig;
    daemonPid: number;
  }
): Promise<void> {
  const { DEFAULT_PORT } = await import('#shared');
  const { createInstance, getSharedToken } = await import('./daemon/daemon-client.js');
  const { VirtualPtyManager } = await import('./pty/virtual-pty.js');
  const { TerminalRelay } = await import('./terminal/terminal-relay.js');
  const { printBanner } = await import('./utils/banner.js');
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

  // Get shared token for WS auth
  const token = getSharedToken();

  // Print banner with instance info
  printBanner({
    url: `http://${context.config.displayIp}:${DEFAULT_PORT}`,
    token,
    instanceName,
    instanceId,
    logDir: context.config.logDir,
    pid: context.daemonPid,
  });

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

  // Fire-and-forget npm version check (non-blocking)
  void (async () => {
    try {
      const { fetchLatestVersion, getCurrentVersion, isNewerVersion } = await import('./update.js');
      const latest = await fetchLatestVersion();
      if (isNewerVersion(latest, getCurrentVersion())) {
        process.stderr.write(`\nUpdate available: ${getCurrentVersion()} → ${latest}. Run: claude-remote update\n`);
      }
    } catch { /* network failure, silently ignore */ }
  })();

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

/**
 * Handle 'list' subcommand - show all running instances
 */
async function handleListCommand(): Promise<void> {
  const { listInstances, isDaemonRunning } = await import('./daemon/daemon-client.js');

  if (!(await isDaemonRunning())) {
    process.stderr.write('No running daemon found.\n');
    process.exit(1);
  }

  let instances: import('#shared').InstanceInfo[];
  try {
    instances = await listInstances();
  } catch (err) {
    process.stderr.write(`Failed to list instances: ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  }

  if (instances.length === 0) {
    process.stdout.write('No running instances.\n');
    return;
  }

  // Format output as table
  const formatRelativeTime = (isoString: string): string => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'just now';
  };

  process.stdout.write(`\nInstances (${instances.length} total):\n\n`);

  // 计算各列动态宽度
  const idWidth = 8;
  const nameWidth = Math.max(12, ...instances.map(i => i.name.length));
  const statusWidth = Math.max(8, ...instances.map(i => (i.status ?? 'unknown').length));
  const clientsWidth = 7;
  const startedWidth = 10;

  // Table header
  const header = [
    'ID'.padEnd(idWidth),
    'NAME'.padEnd(nameWidth),
    'STATUS'.padEnd(statusWidth),
    'CLIENTS'.padEnd(clientsWidth),
    'STARTED'.padEnd(startedWidth),
    'CWD',
  ].join('  ');
  process.stdout.write(`  ${header}\n`);

  // Table rows
  for (const inst of instances) {
    const row = [
      inst.instanceId.substring(0, idWidth).padEnd(idWidth),
      inst.name.padEnd(nameWidth),
      (inst.status ?? 'unknown').padEnd(statusWidth),
      String(inst.clientCount ?? 0).padEnd(clientsWidth),
      formatRelativeTime(inst.startedAt).padEnd(startedWidth),
      inst.cwd,
    ].join('  ');
    process.stdout.write(`  ${row}\n`);
  }

  process.stdout.write('\n');
}

/**
 * Handle 'status' subcommand - show daemon status (read-only, no side effects)
 */
async function handleStatusCommand(): Promise<void> {
  const { getDaemonStatus, isDaemonRunning, getFullVersionInfo } = await import('./daemon/daemon-client.js');

  if (!(await isDaemonRunning())) {
    process.stderr.write('No running daemon found.\n');
    process.exit(1);
  }

  let status: import('./daemon/daemon-client.js').DaemonStatus;
  try {
    status = await getDaemonStatus();
  } catch (err) {
    process.stderr.write(`Failed to get daemon status: ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  }

  const formatUptime = (seconds: number | null): string => {
    if (seconds === null) return 'unknown';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${mins}m ${secs}s`;
  };

  const formatDateTime = (isoString: string | null): string => {
    if (!isoString) return 'unknown';
    return new Date(isoString).toLocaleString();
  };

  process.stdout.write('\nDaemon Status:\n');
  process.stdout.write(`  Status:     running\n`);
  process.stdout.write(`  Version:    ${status.version}\n`);
  process.stdout.write(`  PID:        ${status.pid}\n`);
  process.stdout.write(`  Port:       ${status.port}\n`);
  process.stdout.write(`  Started:    ${formatRelativeTime(status.startedAt)} (${formatDateTime(status.startedAt)})\n`);
  process.stdout.write(`  Uptime:     ${formatUptime(status.uptime)}\n`);
  process.stdout.write(`  Instances:  ${status.instanceCount}\n`);

  // Three-version display
  const versionInfo = await getFullVersionInfo({ npmCheckTimeout: 5000 });

  process.stdout.write('\nVersions:\n');
  process.stdout.write(`  Installed:  ${versionInfo.cliVersion}\n`);

  // Daemon version line
  if (versionInfo.daemonVersion) {
    const daemonTag = versionInfo.needsRestart ? ' (outdated)' : ' ✓';
    process.stdout.write(`  Daemon:     ${versionInfo.daemonVersion}${daemonTag}\n`);
  }

  // Latest version line
  if (versionInfo.latestVersion !== null) {
    const latestTag = versionInfo.updateAvailable ? ' (new)' : ' ✓';
    process.stdout.write(`  Latest:     ${versionInfo.latestVersion}${latestTag}\n`);
  } else {
    process.stdout.write(`  Latest:     (check failed)\n`);
  }

  // Action advice
  switch (versionInfo.advice) {
    case 'restart_daemon':
      process.stdout.write('\n→ Daemon is outdated. Restart with: claude-remote stop && claude-remote\n');
      break;
    case 'update_available':
      process.stdout.write('\n→ Update available. Run: claude-remote update\n');
      break;
    case 'update_and_restart':
      process.stdout.write('\n→ Update first: claude-remote update\n');
      process.stdout.write('  Then restart: claude-remote stop && claude-remote\n');
      break;
  }

  process.stdout.write('\n');
}

/**
 * Format relative time for status command
 */
function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'unknown';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'just now';
}