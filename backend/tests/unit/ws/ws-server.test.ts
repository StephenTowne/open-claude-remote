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
    address: vi.fn(() => ({ port: 6666 })),
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

describe('WsServer', () => {
  let WsServer: typeof import('../../../src/ws/ws-server.js').WsServer;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ WsServer } = await import('../../../src/ws/ws-server.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create without error', () => {
    const mockHttpServer = createMockHttpServer();
    const mockAuthModule = createMockAuthModule();

    const wsServer = new WsServer(mockHttpServer as any, mockAuthModule as any);
    expect(wsServer).toBeDefined();
    wsServer.destroy();
  });

  it('should accept setInstanceManager', () => {
    const mockHttpServer = createMockHttpServer();
    const mockAuthModule = createMockAuthModule();

    const wsServer = new WsServer(mockHttpServer as any, mockAuthModule as any);

    const mockManager = {
      getInstance: vi.fn(),
      pingAllClients: vi.fn(),
    };

    expect(() => wsServer.setInstanceManager(mockManager as any)).not.toThrow();
    wsServer.destroy();
  });

  it('should destroy cleanly', () => {
    const mockHttpServer = createMockHttpServer();
    const mockAuthModule = createMockAuthModule();

    const wsServer = new WsServer(mockHttpServer as any, mockAuthModule as any);
    expect(() => wsServer.destroy()).not.toThrow();
  });

  describe('upgrade handling', () => {
    it('should register upgrade handler on httpServer', () => {
      const mockHttpServer = createMockHttpServer();
      const mockAuthModule = createMockAuthModule();

      // Before creating WsServer, no 'upgrade' listener
      expect(mockHttpServer.listenerCount('upgrade')).toBe(0);

      const wsServer = new WsServer(mockHttpServer as any, mockAuthModule as any);

      // After creating WsServer, 'upgrade' listener should be registered
      expect(mockHttpServer.listenerCount('upgrade')).toBe(1);

      wsServer.destroy();
    });

    it('should reject non-ws paths', () => {
      const mockHttpServer = createMockHttpServer();
      const mockAuthModule = createMockAuthModule();

      const wsServer = new WsServer(mockHttpServer as any, mockAuthModule as any);

      const mockSocket = {
        destroy: vi.fn(),
        write: vi.fn(),
      };

      // Simulate upgrade with invalid path
      mockHttpServer.emit('upgrade', {
        url: '/invalid/path',
        headers: { host: 'localhost' },
        socket: { remoteAddress: '127.0.0.1' },
      }, mockSocket, Buffer.alloc(0));

      expect(mockSocket.destroy).toHaveBeenCalled();

      wsServer.destroy();
    });

    it('should reject when no instanceManager set', () => {
      const mockHttpServer = createMockHttpServer();
      const mockAuthModule = createMockAuthModule();

      const wsServer = new WsServer(mockHttpServer as any, mockAuthModule as any);

      const mockSocket = {
        destroy: vi.fn(),
        write: vi.fn(),
      };

      // Simulate upgrade with valid path but no instanceManager
      mockHttpServer.emit('upgrade', {
        url: '/ws/test-instance-id',
        headers: { host: 'localhost', cookie: 'session_id=test-session-id' },
        socket: { remoteAddress: '127.0.0.1' },
      }, mockSocket, Buffer.alloc(0));

      // 503 Service Unavailable when InstanceManager not set
      expect(mockSocket.write).toHaveBeenCalledWith(expect.stringContaining('503'));
      expect(mockSocket.destroy).toHaveBeenCalled();

      wsServer.destroy();
    });
  });
});
