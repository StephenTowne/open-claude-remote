import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
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
import { logger } from './logger/logger.js';

async function main() {
  // 1. Load configuration
  const config = loadConfig();

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

  // 7. Session controller reference (set after PTY spawn)
  let sessionController: SessionController | null = null;

  // 8. Mount REST API
  app.use('/api', createApiRouter(authModule, hookReceiver, () => sessionController));

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
  if (!process.stdin.isTTY) {
    process.stdin.resume();
    process.stdin.once('close', () => {
      logger.info('stdin pipe closed (parent process exited), initiating shutdown');
      shutdown(0);
    });
  }

  // 16. Start listening
  httpServer.listen(config.port, config.host, () => {
    const url = `http://${config.host}:${config.port}`;
    const tokenPreview = token.length >= 16
      ? `${token.substring(0, 8)}...${token.substring(token.length - 8)}`
      : token;

    // Print access info to stderr so it doesn't mix with PTY output
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
  });
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start');
  process.exit(1);
});
