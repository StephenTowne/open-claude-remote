/**
 * CLI argument parsing utilities.
 *
 * Extracted from cli.ts to avoid static imports in the entry point.
 */

export interface CliOptions {
  host?: string;
  token?: string;
  name?: string;
  help: boolean;
  version: boolean;
  noTerminal: boolean;
  claudeArgs: string[];
  /** attach subcommand */
  attach?: string;
  /** update subcommand */
  update?: boolean;
  /** stop subcommand */
  stop?: boolean;
}

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    help: false,
    version: false,
    noTerminal: false,
    claudeArgs: [],
  };

  let i = 2; // Skip 'node' and script path

  // Check subcommands
  if (argv.length > 2) {
    const firstArg = argv[2];
    if (firstArg === 'attach') {
      if (argv.length <= 3) {
        throw new Error('attach requires a target instance (name or id)');
      }
      options.attach = argv[3];
      return options;
    }
    if (firstArg === 'update') {
      options.update = true;
      return options;
    }
    if (firstArg === 'stop') {
      options.stop = true;
      return options;
    }
  }

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      i++;
    } else if (arg === '--version') {
      options.version = true;
      i++;
    } else if (arg === '--no-terminal') {
      options.noTerminal = true;
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

export function showHelp(): void {
  console.log(`
Claude Code Remote - Control Claude Code from your mobile browser over LAN

Usage:
  claude-remote [options] [--] [claude args...]
  claude-remote attach <name|id>
  claude-remote stop
  claude-remote update

Subcommands:
  attach <name|id>     Attach to a running instance (by name or id)
  stop                 Stop the running daemon and all instances
  update               Update to the latest version (auto-detects npm/pnpm)

Options:
  --host <ip>          Bind address (default: auto-detect LAN IP)
  --token <string>     Auth token (default: shared token)
  --name <string>      Instance name (default: working directory name)
  --no-terminal        Headless mode (internal: for web-spawned instances)
  --version            Show version number
  --help, -h           Show this help message

Config files:
  Global: ~/.claude-remote/settings.json
  Project: <cwd>/.claude-remote/settings.json

  Global settings:
    host            Bind address (default: "0.0.0.0")
    token           Auth token (default: auto-generated shared token)
    sessionTtlMs    Session TTL in ms (default: 86400000 = 24h)
    authRateLimit   Auth rate limit per min per IP (default: 20)
    notifications   Notification channels (dingtalk, wechat_work)

  Claude CLI options (global + project):
    claudeCommand   Claude CLI path (default: "claude")
    claudeArgs      Extra Claude CLI arguments (array, merged & deduped)
    claudeCwd       Claude working directory (default: current dir)

  Instance options (global + project):
    instanceName    Instance name (default: working dir name)
    maxBufferLines  Output buffer max lines (default: 10000)
    workspaces      Allowed working directories for web-spawned instances (array)

  UI options (global + project):
    shortcuts       Quick-input buttons (array, see README for format)
    commands        Custom command buttons (array, see README for format)

Examples:
  claude-remote                    # Start daemon + first instance
  claude-remote chat               # Start in chat mode
  claude-remote --name api         # Custom instance name
  claude-remote -- --dangerously-skip-permissions  # Pass args to claude
  claude-remote attach myproject   # Attach to instance named myproject
  claude-remote stop               # Stop daemon and all instances
  claude-remote update             # Update to latest version

For more Claude Code options, run: claude --help
`);
}

/**
 * Port-in-use error thrown by startServer when EADDRINUSE.
 * Caught by CLI to fall back to client mode.
 */
export class PortInUseError extends Error {
  port: number;
  constructor(port: number) {
    super(`Port ${port} is already in use`);
    this.name = 'PortInUseError';
    this.port = port;
  }
}

/**
 * Start daemon or gracefully fall back to client mode.
 *
 * Flow:
 *   1. Check if daemon is already running → attach as client
 *   2. Try to start daemon server
 *   3. If EADDRINUSE → retry daemon check (race condition: daemon may have been starting)
 *      → attach if found, throw if truly occupied by another process
 */
export async function startOrFallback(
  isDaemonRunning: () => Promise<boolean>,
  startServer: () => Promise<void>,
  attachToNewInstance: () => Promise<void>,
): Promise<'started' | 'attached'> {
  if (await isDaemonRunning()) {
    await attachToNewInstance();
    return 'attached';
  }

  try {
    await startServer();
    return 'started';
  } catch (err) {
    if (err instanceof PortInUseError) {
      // Race condition: daemon may have been starting when we first checked
      if (await isDaemonRunning()) {
        await attachToNewInstance();
        return 'attached';
      }
    }
    throw err;
  }
}