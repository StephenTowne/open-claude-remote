import { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { WS_HEARTBEAT_INTERVAL_MS, MAX_WS_MESSAGE_SIZE } from '#shared';
import type { ServerMessage } from '#shared';
import { AuthModule } from '../auth/auth-middleware.js';
import type { InstanceManager } from '../instance/instance-manager.js';
import type { ClientType } from '../instance/instance-session.js';
import { logger } from '../logger/logger.js';

/**
 * WebSocket server with instance-based routing.
 * URL pattern: /ws/:instanceId
 * Authentication: Cookie Session or ?token=xxx
 *
 * Each WS connection is routed to the corresponding InstanceSession,
 * which manages its own client set and message handling.
 */
export class WsServer {
  private wss: WebSocketServer;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private instanceManager: InstanceManager | null = null;

  constructor(
    private httpServer: HttpServer,
    private authModule: AuthModule,
  ) {
    this.wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_MESSAGE_SIZE });
    this.setupUpgrade();
    this.startHeartbeat();
  }

  /**
   * Inject InstanceManager for routing WS connections.
   */
  setInstanceManager(manager: InstanceManager): void {
    this.instanceManager = manager;
  }

  /**
   * HTTP upgrade → authenticate → route to InstanceSession.
   * URL: /ws/:instanceId
   */
  private setupUpgrade(): void {
    this.httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const pathname = url.pathname;

      // Parse /ws/:instanceId - instanceId is required
      const match = pathname.match(/^\/ws\/([^/]+)$/);
      if (!match) {
        logger.warn({ url: req.url }, 'WS upgrade rejected: invalid path (expected /ws/:instanceId)');
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }

      const instanceId = match[1];
      let clientType: ClientType = 'webapp';

      // Auth method 1: URL token param (for attach clients)
      const tokenParam = url.searchParams.get('token');
      if (tokenParam) {
        if (!this.authModule.verifyToken(tokenParam)) {
          logger.warn({ url: req.url, reason: 'invalid_token_param' }, 'WS upgrade rejected');
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        clientType = 'attach';
      } else {
        // Auth method 2: Cookie Session (for webapp clients)
        const cookieHeader = req.headers.cookie ?? '';
        const sessionId = this.authModule.getSessionFromCookieHeader(cookieHeader);
        const isValid = sessionId ? this.authModule.validateSession(sessionId) : false;

        if (!isValid) {
          logger.warn({
            url: req.url,
            sessionCookieName: this.authModule.getCookieName(),
            hasSessionCookie: Boolean(sessionId),
          }, 'WS upgrade rejected: invalid session');
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        clientType = 'webapp';
      }

      // Validate instanceId and route to InstanceSession
      if (!this.instanceManager) {
        logger.warn('WS upgrade rejected: InstanceManager not set');
        socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
        socket.destroy();
        return;
      }

      const session = this.instanceManager.getInstance(instanceId);
      if (!session) {
        logger.warn({ instanceId }, 'WS upgrade rejected: instance not found');
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(req, socket, head, (ws) => {
        session.addClient(ws, clientType);
        logger.info({
          instanceId,
          clientType,
          remoteAddress: req.socket.remoteAddress,
        }, 'WS client connected to instance');
      });
    });
  }

  /**
   * Start heartbeat pings for all instances.
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.instanceManager) {
        this.instanceManager.pingAllClients();
      }
    }, WS_HEARTBEAT_INTERVAL_MS);

    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  /**
   * Shutdown the WebSocket server.
   */
  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.wss.close();
  }
}
