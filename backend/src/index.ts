import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import express from 'express';
import cors from 'cors';
import { loadConfig } from './config.js';
import { generateToken } from './auth/token-generator.js';
import { AuthModule } from './auth/auth-middleware.js';
import { PtyManager } from './pty/pty-manager.js';
import { WsServer } from './ws/ws-server.js';
import { HookReceiver } from './hooks/hook-receiver.js';
import { SessionController } from './session/session-controller.js';
import { TerminalRelay } from './terminal/terminal-relay.js';
import { createApiRouter } from './api/router.js';
import { PushService } from './push/push-service.js';
import { logger } from './logger/logger.js';
import { writePidFile, removePidFile } from './utils/pid-file.js';

async function main() {
  // 1. Load configuration
  const config = loadConfig();

  // Write PID file for `pnpm stop`
  // Use project root (backend/../) so the path is consistent regardless of CWD
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const pidFilePath = resolve(projectRoot, 'logs', 'app.pid');
  writePidFile(pidFilePath);

  // 2. Generate or use provided auth token
  const token = config.token ?? generateToken();

  // 3. Create Express app
  const app = express();
  app.use(express.json());
  app.use(cors({
    origin: (origin, callback) => {
      // Allow same-origin requests (origin is undefined) and requests from LAN
      if (!origin) {
        callback(null, true);
        return;
      }
      try {
        const url = new URL(origin);
        const expectedHost = config.host === '127.0.0.1' ? 'localhost' : config.host;
        if (url.hostname === config.host || url.hostname === expectedHost || url.hostname === 'localhost') {
          callback(null, true);
          return;
        }
      } catch {
        // invalid origin
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));

  // 4. Create HTTP server
  const httpServer = createServer(app);

  // 5. Setup auth module
  const authModule = new AuthModule({
    token,
    sessionTtlMs: config.sessionTtlMs,
    rateLimitPerMinute: config.authRateLimit,
  });

  // 6. Setup Hook receiver
  const hookReceiver = new HookReceiver();

  // 7. Setup Push service
  const pushService = new PushService();

  // 8. Session controller reference (set after PTY spawn)
  let sessionController: SessionController | null = null;

  // 9. Mount REST API
  app.use('/api', createApiRouter(authModule, hookReceiver, () => sessionController, pushService));

  // 9. Serve frontend static files (if built)
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const frontendDist = resolve(__dirname, '../../frontend/dist');
  if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    // SPA fallback — skip /api and /ws paths to avoid hijacking backend routes
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
        return next();
      }
      res.sendFile(resolve(frontendDist, 'index.html'));
    });
    logger.info({ path: frontendDist }, 'Serving frontend static files');
  } else {
    logger.warn('Frontend dist not found, skipping static file serving');
  }

  // 10. Create WebSocket server
  const wsServer = new WsServer(httpServer, authModule);

  // 11. Spawn PTY with Claude Code CLI
  const ptyManager = new PtyManager();

  // 12. Create Session Controller
  sessionController = new SessionController(ptyManager, wsServer, hookReceiver, config.maxBufferLines);
  sessionController.setPushService(pushService);

  // 13. Start Terminal Relay (raw mode)
  const relay = new TerminalRelay(ptyManager);

  // 14. Spawn Claude Code
  ptyManager.spawn({
    command: config.claudeCommand,
    args: config.claudeArgs,
    cwd: config.claudeCwd,
  });

  // Start relay after spawn
  relay.start();
  sessionController.setStatus('running');

  // 15. Unified graceful shutdown
  let shuttingDown = false;
  const shutdown = (exitCode: number = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ exitCode }, 'Shutting down...');
    removePidFile(pidFilePath);
    relay.stop();
    // Pause stdin to remove it as an active event loop handle
    if (!process.stdin.isTTY) {
      process.stdin.pause();
    }
    ptyManager.destroy();
    wsServer.destroy();
    authModule.destroy();
    httpServer.close(() => {
      process.exit(exitCode);
    });
    // Force exit if httpServer.close hangs (ref'd to guarantee it fires)
    setTimeout(() => process.exit(exitCode), 2000);
  };

  // Handle PTY exit → graceful shutdown
  ptyManager.on('exit', (exitCode: number) => {
    logger.info({ exitCode }, 'Claude Code exited');
    // Give time for WS messages to flush, then shutdown
    setTimeout(() => shutdown(exitCode), 500);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received');
    shutdown(0);
  });
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received');
    shutdown(0);
  });

  // When running via pnpm dev (stdin is a pipe, not TTY), detect parent process exit
  // via stdin close event — this fires when concurrently/pnpm terminates
  // Also handle Ctrl+C which may come through stdin in pipe mode
  if (!process.stdin.isTTY) {
    process.stdin.resume();

    // Kitty keyboard protocol CSI u variants for Ctrl+C:
    // Match press/repeat (event type 1 or 2) but not release (3)
    const CTRL_C = '\x03';
    const KITTY_CTRL_C_RE = /\x1b\[99;5(?::(?:[12]))?(?:;\d+)*u/;

    // Use 'readable' event for immediate reads without waiting for newline
    // In pipe mode, 'data' event is line-buffered and waits for Enter
    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        const str = chunk.toString();
        logger.info({ hex: chunk.toString('hex'), len: chunk.length, str: str.replace(/\x1b/g, 'ESC') }, 'stdin data received in non-TTY mode');
        // Single Ctrl+C (classic ETX or Kitty protocol) → shutdown immediately
        if (str === CTRL_C || KITTY_CTRL_C_RE.test(str)) {
          logger.info('Ctrl+C detected in pipe mode, initiating shutdown');
          shutdown(0);
        }
      }
    });

    process.stdin.once('close', () => {
      logger.info('stdin pipe closed (parent process exited), initiating shutdown');
      shutdown(0);
    });
  }

  // 16. Start listening
  httpServer.listen(config.port, config.host, () => {
    const url = `http://${config.host}:${config.port}`;
    const isCli = process.env.CLI_MODE === 'true';

    if (isCli) {
      // CLI mode: write connection info to file, keep terminal clean
      const logDir = resolve(projectRoot, 'logs');
      mkdirSync(logDir, { recursive: true });
      const connectionInfo = `URL: ${url}\nToken: ${token}\n`;
      writeFileSync(resolve(logDir, 'connection.txt'), connectionInfo);
      logger.info({ url }, 'Server started');
    } else {
      // Dev/production mode: print banner to stderr
      const tokenPreview = token.length >= 16
        ? `${token.substring(0, 8)}...${token.substring(token.length - 8)}`
        : token;

      process.stderr.write('\n');
      process.stderr.write('╔══════════════════════════════════════════════════╗\n');
      process.stderr.write('║         Claude Code Remote Proxy Started         ║\n');
      process.stderr.write('╠══════════════════════════════════════════════════╣\n');
      process.stderr.write(`║  URL:   ${url.padEnd(40)}║\n`);
      process.stderr.write(`║  Token: ${tokenPreview.padEnd(40)}║\n`);
      process.stderr.write('╠══════════════════════════════════════════════════╣\n');
      process.stderr.write(`║  Full Token (copy to phone):                     ║\n`);
      process.stderr.write(`║  ${token.padEnd(48)}║\n`);
      process.stderr.write('╚══════════════════════════════════════════════════╝\n');
      process.stderr.write('\n');

      logger.info({ url, host: config.host, port: config.port }, 'Server started');
    }
  });
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start');
  process.exit(1);
});
