import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { CLAUDE_REMOTE_DIR, SETTINGS_DIR } from '#shared';
import { loadConfig, createSessionCookieName, createClaudeSettings, extractSettingsFromArgs, saveClaudeSettings, ensureDefaultUserConfig, type CliOverrides } from './config.js';
import { AuthModule } from './auth/auth-middleware.js';
import { PtyManager } from './pty/pty-manager.js';
import { WsServer } from './ws/ws-server.js';
import { HookReceiver } from './hooks/hook-receiver.js';
import { SessionController } from './session/session-controller.js';
import { TerminalRelay } from './terminal/terminal-relay.js';
import { createApiRouter } from './api/router.js';
import { PushService } from './push/push-service.js';
import { createNotificationManager } from './notification/notification-manager.js';
import { createNotificationServiceFactory } from './notification/notification-service-factory.js';
import { logger, setInstanceContext } from './logger/logger.js';
import { getOrCreateSharedToken } from './registry/shared-token.js';
import { findAvailablePort } from './registry/port-finder.js';
import { InstanceRegistryManager } from './registry/instance-registry.js';
import { InstanceSpawner } from './registry/instance-spawner.js';
import { IpMonitor } from './utils/ip-monitor.js';
import { generateQRCodeLines } from './utils/qrcode-banner.js';
import { getCurrentVersion } from './update.js';

export async function startServer(cliOverrides: CliOverrides = {}): Promise<void> {
  // 1. Load configuration
  const config = loadConfig(cliOverrides);

  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

  // 1.5. Ensure default shortcuts/commands in user config
  await ensureDefaultUserConfig();

  // 2. Shared config directory and token
  const sharedConfigDir = resolve(homedir(), CLAUDE_REMOTE_DIR);
  const { token, source: tokenSource } = getOrCreateSharedToken(sharedConfigDir, config.token ?? undefined);

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

  // 设置日志实例上下文，后续所有日志自动包含 instancePort 字段
  setInstanceContext(actualPort);

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
  const pushService = new PushService(sharedConfigDir);

  // 9.1. Create NotificationManager for dynamic enabled status checking
  const notificationManager = createNotificationManager();

  // 9.2. Create NotificationServiceFactory for lazy-loading notification services
  const notificationServiceFactory = createNotificationServiceFactory();

  // 10. Session controller reference (set after PTY spawn)
  let sessionController: SessionController | null = null;

  // 10.5. Create Instance Spawner (for creating new instances via API)
  const instanceSpawner = new InstanceSpawner();

  // 11. Create WebSocket server (needed for API routes)
  const wsServer = new WsServer(httpServer, authModule);

  // 12. Mount REST API (with instance routes)
  app.use('/api', createApiRouter({
    authModule,
    hookReceiver,
    getController: () => sessionController,
    pushService,
    listInstances: () => registry.list(),
    currentInstanceId: instanceId,
    instanceSpawner,
    notificationManager,
    notificationServiceFactory,
    wsServer,
  }));

  // 13. Serve frontend static files (if built)
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // 开发模式 (tsx backend/src/index.ts): __dirname = backend/src/ → ../../frontend-dist
  // 生产构建 (node dist/backend/src/index.js): __dirname = dist/backend/src/ → ../../../frontend-dist
  const isDistBuild = __dirname.includes('/dist/');
  const frontendDist = resolve(__dirname, isDistBuild ? '../../../frontend-dist' : '../../frontend-dist');

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

  // 14. Spawn PTY with Claude Code CLI
  const ptyManager = new PtyManager();

  // 15. Terminal Relay (条件启动，headless 模式跳过)
  const noTerminal = process.env.NO_TERMINAL === 'true';
  const relay = (!noTerminal && process.stdin.isTTY) ? new TerminalRelay(ptyManager) : undefined;

  // 16. Create Session Controller (with relay for dynamic master switch)
  sessionController = new SessionController(ptyManager, wsServer, hookReceiver, config.maxBufferLines, relay);
  sessionController.setPushService(pushService);
  sessionController.setNotificationManager(notificationManager);
  sessionController.setNotificationServiceFactory(notificationServiceFactory);
  // 设置实例 URL（初始化）
  const instanceUrl = `http://${config.displayIp}:${actualPort}`;
  sessionController.setInstanceUrl(instanceUrl);

  // 17. Spawn Claude Code with instance-specific hook settings
  // 检查用户是否传了 --settings 参数，如果有则合并 hooks
  const extracted = extractSettingsFromArgs(config.claudeArgs);
  let finalArgs: string[];

  // 生成最终的 settings 对象
  const finalSettings = createClaudeSettings(actualPort, extracted?.settingsValue);

  // 保存到文件并通过文件路径传递给 Claude
  const settingsPath = saveClaudeSettings(finalSettings, actualPort, sharedConfigDir);

  if (extracted) {
    finalArgs = [...extracted.otherArgs, '--settings', settingsPath];
    logger.info({ port: actualPort, originalSettingsPath: extracted.settingsPath, savedSettingsPath: settingsPath }, 'Merged user settings with hooks');
  } else {
    finalArgs = [...config.claudeArgs, '--settings', settingsPath];
    logger.info({ port: actualPort, savedSettingsPath: settingsPath }, 'Generated Claude settings with instance-specific hook URL');
  }

  ptyManager.on('error', (err: Error) => {
    logger.error({ err }, 'PTY process error');
    process.stderr.write(`\n[ERROR] Failed to start Claude CLI: ${err.message}\n`);
    registry.unregister(instanceId);
    process.exit(1);
  });

  ptyManager.spawn({
    command: config.claudeCommand,
    args: finalArgs,
    cwd: config.claudeCwd,
  });

  // Start relay after spawn (if not headless)
  if (relay) {
    relay.start();
  }
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
    headless: noTerminal,
    claudeArgs: config.claudeArgs.length > 0 ? config.claudeArgs : undefined,
  });

  // 18.5. Clean up stale settings files for dead instances
  try {
    const settingsDir = resolve(sharedConfigDir, SETTINGS_DIR);
    if (existsSync(settingsDir)) {
      const alivePorts = new Set((await registry.list()).map(i => i.port));
      for (const file of readdirSync(settingsDir)) {
        const match = file.match(/^(\d+)\.json$/);
        if (match) {
          const port = parseInt(match[1], 10);
          if (!alivePorts.has(port)) {
            try {
              unlinkSync(resolve(settingsDir, file));
              logger.info({ file, port }, 'Cleaned up stale settings file');
            } catch {
              // 静默处理：清理失败不影响启动
            }
          }
        }
      }
    }
  } catch (err) {
    logger.debug({ err }, 'Settings cleanup skipped');
  }

  // 18.6. Start IP monitor
  const ipMonitor = new IpMonitor((newIp, oldIp) => {
    const newUrl = `http://${newIp}:${actualPort}`;
    logger.info({ oldIp, newIp, newUrl }, 'IP change detected');

    // Update config
    config.displayIp = newIp;

    // Update registry
    registry.updateHost(instanceId, newIp);

    // Update instance URL in session controller
    sessionController?.setInstanceUrl(newUrl);

    // Broadcast to all connected clients
    wsServer.broadcast({
      type: 'ip_changed',
      oldIp,
      newIp,
      newUrl,
    });
  }, 30000, 2); // 30s interval, 2 consecutive detections required

  ipMonitor.start(config.displayIp);

  // 19. Unified graceful shutdown
  let shuttingDown = false;
  const shutdown = (exitCode: number = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ exitCode }, 'Shutting down...');
    // Unregister from shared registry
    registry.unregister(instanceId);
    if (relay) {
      relay.stop();
    }
    ipMonitor.stop();
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

  // 20. Handle port collision (TOCTOU between findAvailablePort and listen)
  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error({ port: actualPort, host: config.host }, 'Port is already in use (TOCTOU race). Another process claimed it between port check and listen.');
      process.exit(1);
    }
    logger.error({ err }, 'HTTP server error');
    process.exit(1);
  });

  // 21. Start listening
  httpServer.listen(actualPort, config.host, () => {
    const url = `http://${config.displayIp}:${actualPort}`;
    const qrUrl = `${url}?token=${token}`;
    const qrLines = generateQRCodeLines(qrUrl);

    // Version (with fallback)
    let version = '';
    try { version = getCurrentVersion(); } catch { /* ignore */ }

    // Left column: instance info + commands
    const leftLines: string[] = [];
    leftLines.push(`Instance:  ${config.instanceName}`);
    leftLines.push(`URL:       ${url}`);
    leftLines.push(`PID:       ${process.pid}`);
    leftLines.push(`Logs:      ${config.logDir}`);
    leftLines.push('');
    leftLines.push('Commands:');
    leftLines.push(`  attach:  claude-remote attach ${actualPort}`);
    leftLines.push('  update:  claude-remote update');

    // Right column: QR lines + blank + centered label
    const qrLabel = 'Scan QR to connect';
    const rightLines: string[] = [...qrLines, ''];
    const targetHeight = Math.max(leftLines.length, rightLines.length + 1);
    while (rightLines.length < targetHeight - 1) {
      rightLines.push('');
    }
    rightLines.push(qrLabel);

    // Width calculations
    const qrWidth = Math.max(qrLines[0]?.length || 0, qrLabel.length);
    const leftWidth = Math.max(...leftLines.map(l => l.length), 35);
    const totalWidth = leftWidth + qrWidth + 6;

    // Border components
    const topBorder    = '╔' + '═'.repeat(totalWidth - 2) + '╗';
    const title        = version ? `Claude Code Remote v${version}` : 'Claude Code Remote';
    const titleLine    = '║' + title.padStart(Math.floor((totalWidth - 2 + title.length) / 2)).padEnd(totalWidth - 2) + '║';
    const sepLine      = '╠' + '═'.repeat(leftWidth + 1) + '╤' + '═'.repeat(qrWidth + 2) + '╣';
    const midSep       = '╠' + '═'.repeat(leftWidth + 1) + '╧' + '═'.repeat(qrWidth + 2) + '╣';
    const tokenLine    = '║ ' + `Token: ${token}`.padEnd(totalWidth - 4) + ' ║';
    const bottomBorder = '╚' + '═'.repeat(totalWidth - 2) + '╝';

    // Render three-section banner
    process.stderr.write('\n');
    process.stderr.write(topBorder + '\n');
    process.stderr.write(titleLine + '\n');
    process.stderr.write(sepLine + '\n');

    const maxLines = Math.max(leftLines.length, rightLines.length);
    for (let i = 0; i < maxLines; i++) {
      const left = (leftLines[i] || '').padEnd(leftWidth);
      let right: string;
      if (i < qrLines.length && rightLines[i]) {
        right = ` ${rightLines[i]} `.padEnd(qrWidth + 2);
      } else if (rightLines[i]) {
        const centered = rightLines[i].padStart(Math.floor((qrWidth + rightLines[i].length) / 2)).padEnd(qrWidth);
        right = ` ${centered} `;
      } else {
        right = ' '.repeat(qrWidth + 2);
      }
      process.stderr.write(`║ ${left}│${right}║\n`);
    }

    process.stderr.write(midSep + '\n');
    process.stderr.write(tokenLine + '\n');
    process.stderr.write(bottomBorder + '\n');
    process.stderr.write('\n');

    logger.info({ url, host: config.host, port: actualPort, instanceName: config.instanceName, tokenSource }, 'Server started');
  });
}

// Auto-start when run directly (non-CLI mode)
// CLI mode: cli.ts imports startServer() directly
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer().catch((err) => {
    logger.error({ err }, 'Failed to start');
    process.exit(1);
  });
}
