/**
 * CLI argument parsing utilities.
 *
 * Extracted from cli.ts to avoid static imports in the entry point.
 */

export interface CliOptions {
  port?: number;
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
        throw new Error('attach requires a target instance (port or name)');
      }
      options.attach = argv[3];
      return options;
    }
    if (firstArg === 'update') {
      options.update = true;
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

export function showHelp(): void {
  console.log(`
Claude Code Remote - Control Claude Code from your mobile browser over LAN

Usage:
  claude-remote [options] [--] [claude args...]
  claude-remote attach <port|name>
  claude-remote update

Subcommands:
  attach <port|name>   Attach to a running instance (by port or name)
  update               Update to the latest version (auto-detects npm/pnpm)

Options:
  --port <number>      Server port (default: 3000, auto-increments if busy)
  --host <ip>          Bind address (default: auto-detect LAN IP)
  --token <string>     Auth token (default: shared token)
  --name <string>      Instance name (default: working directory name)
  --no-terminal        Headless mode (internal: for web-spawned instances)
  --version            Show version number
  --help, -h           Show this help message

Config file:
  ~/.claude-remote/config.json

  Server options:
    port            Server port (default: 3000)
    host            Bind address (default: "0.0.0.0")
    token           Auth token (default: auto-generated shared token)
    sessionTtlMs    Session TTL in ms (default: 86400000 = 24h)
    authRateLimit   Auth rate limit per min per IP (default: 20)

  Claude CLI options:
    claudeCommand   Claude CLI path (default: "claude")
    claudeArgs      Extra Claude CLI arguments (array)
    claudeCwd       Claude working directory (default: current dir)

  Instance options:
    instanceName    Instance name (default: working dir name)
    maxBufferLines  Output buffer max lines (default: 10000)
    workspaces      Allowed working directories for web-spawned instances (array)

  UI options:
    shortcuts       Quick-input buttons (array, see README for format)
    commands        Custom command buttons (array, see README for format)

  Notification options:
    dingtalk        DingTalk notification config (object)
                   Example: { "webhookUrl": "https://oapi.dingtalk.com/..." }

Examples:
  claude-remote                    # Start Claude Code
  claude-remote chat               # Start in chat mode
  claude-remote --port 8080        # Use port 8080
  claude-remote --name api         # Custom instance name
  claude-remote -- --dangerously-skip-permissions  # Pass args to claude
  claude-remote attach 3001        # Attach to instance on port 3001
  claude-remote attach myproject   # Attach to instance named myproject
  claude-remote update             # Update to latest version

For more Claude Code options, run: claude --help
`);
}