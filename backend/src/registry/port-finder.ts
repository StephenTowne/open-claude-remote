import { createServer } from 'node:net';
import { logger } from '../logger/logger.js';

/**
 * 检测指定端口是否可用。
 */
function isPortAvailable(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

/**
 * 从 preferredPort 开始递增查找可用端口。
 * @param preferredPort 首选端口
 * @param host 绑定地址
 * @param maxAttempts 最大尝试次数（默认 100）
 */
export async function findAvailablePort(
  preferredPort: number,
  host: string,
  maxAttempts: number = 100,
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = preferredPort + i;
    if (port > 65535) break;

    if (await isPortAvailable(port, host)) {
      if (i > 0) {
        logger.info({ preferredPort, assignedPort: port }, 'Preferred port occupied, using alternative');
      }
      return port;
    }
  }

  throw new Error(`No available port found starting from ${preferredPort} after ${maxAttempts} attempts`);
}
