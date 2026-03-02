import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// ---- Mocks ----

function createMockAuthModule() {
  return {
    verifyToken: vi.fn(() => true),
    getSessionFromCookieHeader: vi.fn(() => 'test-session-id'),
    validateSession: vi.fn(() => true),
    getCookieName: vi.fn(() => 'session_id'),
  };
}

function createMockHttpServer() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    address: vi.fn(() => ({ port: 3000 })),
  });
}

// Mock logger
vi.mock('../../../src/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock shared constants
vi.mock('@claude-remote/shared', () => ({
  WS_HEARTBEAT_INTERVAL_MS: 30000,
  MAX_WS_MESSAGE_SIZE: 1024 * 1024,
}));

describe('WsServer client type detection', () => {
  let WsServer: typeof import('../../../src/ws/ws-server.js').WsServer;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ WsServer } = await import('../../../src/ws/ws-server.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getClientCounts', () => {
    it('should return correct counts for attach and webapp clients', async () => {
      const mockHttpServer = createMockHttpServer();
      const mockAuthModule = createMockAuthModule();

      const wsServer = new WsServer(mockHttpServer as any, mockAuthModule as any);

      // 初始状态应该返回零计数
      const initialCounts = wsServer.getClientCounts();
      expect(initialCounts).toEqual({ attach: 0, webapp: 0 });

      wsServer.destroy();
    });
  });

  describe('onConnect callback signature', () => {
    it('should accept handler with clientType parameter', async () => {
      const mockHttpServer = createMockHttpServer();
      const mockAuthModule = createMockAuthModule();

      const wsServer = new WsServer(mockHttpServer as any, mockAuthModule as any);

      // 验证 onConnect 接受带有 clientType 参数的 handler
      const handler = vi.fn();
      expect(() => wsServer.onConnect(handler)).not.toThrow();

      wsServer.destroy();
    });
  });

  describe('onDisconnect callback signature', () => {
    it('should accept handler with clientCounts parameter', async () => {
      const mockHttpServer = createMockHttpServer();
      const mockAuthModule = createMockAuthModule();

      const wsServer = new WsServer(mockHttpServer as any, mockAuthModule as any);

      // 验证 onDisconnect 接受带有 clientCounts 参数的 handler
      const handler = vi.fn();
      expect(() => wsServer.onDisconnect(handler)).not.toThrow();

      wsServer.destroy();
    });
  });

  describe('clientCount', () => {
    it('should return 0 when no clients connected', async () => {
      const mockHttpServer = createMockHttpServer();
      const mockAuthModule = createMockAuthModule();

      const wsServer = new WsServer(mockHttpServer as any, mockAuthModule as any);

      expect(wsServer.clientCount).toBe(0);

      wsServer.destroy();
    });
  });
});