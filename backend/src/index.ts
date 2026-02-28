import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { CLAUDE_REMOTE_DIR } from '@claude-remote/shared';
import { loadConfig, createSessionCookieName } from './config.js';
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
import { getOrCreateSharedToken } from './registry/shared-token.js';
import { findAvailablePort } from './registry/port-finder.js';
import { InstanceRegistryManager } from './registry/instance-registry.js';

async function main() {
  // 1. Load configuration
  const config = loadConfig();

  // Write PID file for `pnpm stop`
  // Use project root (backend/../) so the path is consistent regardless of CWD
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const pidFilePath = resolve(projectRoot, 'logs', 'app.pid');
  writePidFile(pidFilePath);

  // 2. Shared config directory and token
  const sharedConfigDir = resolve(homedir(), CLAUDE_REMOTE_DIR);
  const { token, source: tokenSource } = getOrCreateSharedToken(sharedConfigDir);

  // 3. Instance ID and registry
  const instanceId = randomUUID();
  const registry = new InstanceRegistryManager(sharedConfigDir);

  // 4. Find available port (auto-increment if preferred port is occupied)
  const actualPort = await findAvailablePort(config.port, config.host);

  // Update config to reflect the actual port (cookie name must match actual port
  // to prevent cross-instance cookie collision when port auto-increments)
  if (actualPort !== config.port) {
    config.sessionCookieName = createSessionCookieName(actualPort);
    config.port = actualPort;
    logger.info({
      actualPort,
      sessionCookieName: config.sessionCookieName,
    }, 'Config updated for actual port');
  }

  // 5. Create Express app
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
        // 允许同一 host 的任意端口（多实例跨端口访问）
        const allowedHosts = [config.displayIp, 'localhost', '127.0.0.1'];
        if (allowedHosts.includes(url.hostname)) {
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

  // 6. Create HTTP server
  const httpServer = createServer(app);

  // 7. Setup auth module
  const authModule = new AuthModule({
    token,
    sessionTtlMs: config.sessionTtlMs,
    rateLimitPerMinute: config.authRateLimit,
    cookieName: config.sessionCookieName,
  });

  // 8. Setup Hook receiver
  const hookReceiver = new HookReceiver();

  // 9. Setup Push service
  const pushService = new PushService();

  // 10. Session controller reference (set after PTY spawn)
  let sessionController: SessionController | null = null;

  // 11. Mount REST API (with instance routes)
  app.use('/api', createApiRouter({
    authModule,
    hookReceiver,
    getController: () => sessionController,
    pushService,
    listInstances: () => registry.list(),
    currentInstanceId: instanceId,
  }));

  // 12. Serve frontend static files (if built)
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

  // 13. Create WebSocket server
  const wsServer = new WsServer(httpServer, authModule);

  // 14. Spawn PTY with Claude Code CLI
  const ptyManager = new PtyManager();

  // 15. Create Session Controller
  sessionController = new SessionController(ptyManager, wsServer, hookReceiver, config.maxBufferLines);
  sessionController.setPushService(pushService);

  // 16. Start Terminal Relay (raw mode)
  const relay = new TerminalRelay(ptyManager);

  // 17. Spawn Claude Code
  ptyManager.spawn({
    command: config.claudeCommand,
    args: config.claudeArgs,
    cwd: config.claudeCwd,
  });

  // Start relay after spawn
  relay.start();
  sessionController.setStatus('running');

  // 18. Register instance in shared registry
  registry.register({
    instanceId,
    name: config.instanceName,
    host: config.displayIp,
    port: actualPort,
    pid: process.pid,
    cwd: config.claudeCwd,
    startedAt: new Date().toISOString(),
  });

  // 19. Unified graceful shutdown
  let shuttingDown = false;
  const shutdown = (exitCode: number = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ exitCode }, 'Shutting down...');
    // Unregister from shared registry
    registry.unregister(instanceId);
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

  // 20. Start listening
  httpServer.listen(actualPort, config.host, () => {
    const url = `http://${config.displayIp}:${actualPort}`;
    const isCli = process.env.CLI_MODE === 'true';

    if (isCli) {
      // CLI mode: write connection info to file, keep terminal clean
      const logDir = resolve(projectRoot, 'logs');
      mkdirSync(logDir, { recursive: true });
      const connectionInfo = `URL: ${url}\nToken: ${token}\nInstanceId: ${instanceId}\nName: ${config.instanceName}\n`;
      writeFileSync(resolve(logDir, 'connection.txt'), connectionInfo);
      logger.info({ url, instanceName: config.instanceName }, 'Server started');
    } else {
      // Dev/production mode: print banner to stderr
      const isFirstInstance = tokenSource === 'generated';

      process.stderr.write('\n');
      process.stderr.write('╔══════════════════════════════════════════════════╗\n');
      process.stderr.write('║         Claude Code Remote Proxy Started         ║\n');
      process.stderr.write('╠══════════════════════════════════════════════════╣\n');
      process.stderr.write(`║  Instance: ${config.instanceName.padEnd(37)}║\n`);
      process.stderr.write(`║  URL:      ${url.padEnd(37)}║\n`);

      if (isFirstInstance) {
        // 首次启动（生成了新 Token）：完整显示 Token
        const tokenPreview = token.length >= 16
          ? `${token.substring(0, 8)}...${token.substring(token.length - 8)}`
          : token;
        process.stderr.write(`║  Token:    ${tokenPreview.padEnd(37)}║\n`);
        process.stderr.write('╠══════════════════════════════════════════════════╣\n');
        process.stderr.write(`║  Full Token (copy to phone):                     ║\n`);
        process.stderr.write(`║  ${token.padEnd(48)}║\n`);
      } else {
        // 后续启动（读取共享 Token）：简短提示
        process.stderr.write(`║  Token:    ${'(shared, see first instance)'.padEnd(37)}║\n`);
      }

      process.stderr.write('╚══════════════════════════════════════════════════╝\n');
      process.stderr.write('\n');

      logger.info({ url, host: config.host, port: actualPort, instanceName: config.instanceName, tokenSource }, 'Server started');
    }
  });
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start');
  process.exit(1);
});
