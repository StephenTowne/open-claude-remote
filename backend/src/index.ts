import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import express from 'express';
import cors from 'cors';
import { DEFAULT_PORT } from '#shared';
import { loadConfig, ensureDefaultUserConfig, type CliOverrides } from './config.js';
import { PortInUseError } from './cli-utils.js';
import { AuthModule } from './auth/auth-middleware.js';
import { WsServer } from './ws/ws-server.js';
import { InstanceManager } from './instance/instance-manager.js';
import { TerminalRelay } from './terminal/terminal-relay.js';
import { createApiRouter } from './api/router.js';
import { setDaemonStartTime } from './api/health-routes.js';
import { PushService } from './push/push-service.js';
import { createNotificationManager } from './notification/notification-manager.js';
import { createNotificationServiceFactory } from './notification/notification-service-factory.js';
import { logger, setInstanceContext } from './logger/logger.js';
import { getOrCreateSharedToken } from './registry/shared-token.js';
import { IpMonitor } from './utils/ip-monitor.js';
import { printBanner } from './utils/banner.js';

export async function startServer(cliOverrides: CliOverrides = {}): Promise<void> {
  // 1. Load configuration (global + workdir merged)
  const config = loadConfig(cliOverrides);

  // 1.5. Ensure default shortcuts/commands in user config
  await ensureDefaultUserConfig();

  // 2. Shared config directory and token
  const homeConfigDir = resolve(process.env.HOME ?? process.env.USERPROFILE ?? '', '.claude-remote');
  const { token, source: tokenSource } = getOrCreateSharedToken(homeConfigDir, config.token ?? undefined);

  // 3. Fixed port (8866)
  const port = config.port; // DEFAULT_PORT

  // 设置日志实例上下文
  setInstanceContext(port);

  // 5. Create Express app
  const app = express();
  app.use(express.json());
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      try {
        const url = new URL(origin);
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

  // 7. Setup auth module (fixed cookie name: session_id)
  const authModule = new AuthModule({
    token,
    sessionTtlMs: config.sessionTtlMs,
    rateLimitPerMinute: config.authRateLimit,
    cookieName: config.sessionCookieName,
  });

  // 8. Setup Push service
  const pushService = new PushService(homeConfigDir);

  // 8.1. Create NotificationManager for dynamic enabled status checking
  const notificationManager = createNotificationManager();

  // 8.2. Create NotificationServiceFactory for lazy-loading notification services
  const notificationServiceFactory = createNotificationServiceFactory();

  // 9. InstanceManager (replaces SessionController)
  const instanceManager = new InstanceManager();
  instanceManager.setSharedServices({
    pushService,
    notificationManager,
    notificationServiceFactory,
    displayIp: config.displayIp,
  });

  // 10. Create WebSocket server (with InstanceManager routing)
  const wsServer = new WsServer(httpServer, authModule);
  wsServer.setInstanceManager(instanceManager);

  // 11. Mount REST API
  app.use('/api', createApiRouter({
    authModule,
    instanceManager,
    pushService,
    notificationManager,
    notificationServiceFactory,
    onShutdown: () => shutdown(0),
  }));

  // 12. Serve frontend static files (if built)
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const isDistBuild = __dirname.includes('/dist/');
  const frontendDist = resolve(__dirname, isDistBuild ? '../../../frontend-dist' : '../../frontend-dist');

  if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
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

  // 13. Create first instance (skip in daemon mode — instances created via API)
  const daemonMode = cliOverrides.daemonMode === true;
  let firstSession: ReturnType<typeof instanceManager.createInstance> | undefined;
  let relay: TerminalRelay | undefined;

  if (!daemonMode) {
    const noTerminal = process.env.NO_TERMINAL === 'true';
    firstSession = instanceManager.createInstance({
      cwd: config.claudeCwd,
      name: config.instanceName,
      claudeCommand: config.claudeCommand,
      claudeArgs: config.claudeArgs,
      headless: noTerminal,
    });

    // 14. Terminal Relay (条件启动，headless 模式跳过)
    //     PTY output → stdout: InstanceSession 只广播给 WS 客户端，CLI 需要额外管道
    const isTTY = !noTerminal && process.stdin.isTTY;
    if (isTTY) {
      firstSession.ptyManager.on('data', (data: string) => {
        process.stdout.write(data);
      });
    }
    relay = isTTY ? new TerminalRelay(firstSession.ptyManager) : undefined;
    if (relay) {
      relay.start();
    }
  }

  // 15. IP monitor
  const ipMonitor = new IpMonitor((newIp, oldIp) => {
    logger.info({ oldIp, newIp }, 'IP change detected');
    config.displayIp = newIp;
    instanceManager.updateDisplayIp(newIp);
  }, 30000, 2);

  ipMonitor.start(config.displayIp);

  // 16. Unified graceful shutdown
  let shuttingDown = false;
  const shutdown = (exitCode: number = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ exitCode }, 'Shutting down...');
    if (relay) {
      relay.stop();
    }
    ipMonitor.stop();
    if (!process.stdin.isTTY) {
      process.stdin.pause();
    }
    instanceManager.destroyAll();
    wsServer.destroy();
    authModule.destroy();
    httpServer.close(() => {
      process.exit(exitCode);
    });
    setTimeout(() => process.exit(exitCode), 2000);
  };

  // Handle first instance PTY exit (only in non-daemon mode)
  if (firstSession) {
    const session = firstSession;
    session.on('exit', (exitCode: number) => {
      logger.info({ exitCode, instanceId: session.instanceId }, 'First instance PTY exited');
      if (relay) {
        relay.stop();
      }
      // 打印提示后 CLI 退出，daemon 后台运行
      process.stderr.write(`\nInstance "${session.name}" exited with code ${exitCode}.\n`);
      process.stderr.write('Daemon is still running. Use "claude-remote stop" to shut down.\n\n');

      // CLI 退出，daemon 继续后台运行
      // 注意：不调用 shutdown()，只移除 CLI 相关的事件监听并退出进程
      if (!process.stdin.isTTY) {
        process.stdin.pause();
      }
      process.exit(exitCode);
    });
  }

  process.on('SIGINT', () => {
    logger.info('SIGINT received');
    shutdown(0);
  });
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received');
    shutdown(0);
  });

  // When running via pnpm dev (stdin is a pipe, not TTY) — skip in daemon mode
  if (!daemonMode && !process.stdin.isTTY) {
    process.stdin.resume();

    const CTRL_C = '\x03';
    const KITTY_CTRL_C_RE = /\x1b\[99;5(?::(?:[12]))?(?:;\d+)*u/;

    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        const str = chunk.toString();
        logger.info({ hex: chunk.toString('hex'), len: chunk.length, str: str.replace(/\x1b/g, 'ESC') }, 'stdin data received in non-TTY mode');
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

  // 17. Start listening (awaitable: resolves on success, rejects on error)
  await new Promise<void>((resolve, reject) => {
    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.warn({ port, host: config.host }, 'Port is already in use, will attempt fallback');
        reject(new PortInUseError(port));
        return;
      }
      logger.error({ err }, 'HTTP server error');
      reject(err);
    });

    httpServer.listen(port, config.host, () => {
      // Record daemon start time
      setDaemonStartTime(new Date().toISOString());

      const url = `http://${config.displayIp}:${port}`;

      if (!daemonMode) {
        // CLI 直接启动模式（pnpm dev 等）：打印 banner
        printBanner({
          url,
          token,
          instanceName: config.instanceName,
          logDir: config.logDir,
          pid: process.pid,
        });
      }

      logger.info({ url, host: config.host, port, instanceName: config.instanceName, tokenSource, daemonMode }, 'Server started');
      resolve();
    });
  });
}

// Auto-start when run directly (non-CLI mode)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer().catch((err) => {
    logger.error({ err }, 'Failed to start');
    process.exit(1);
  });
}
