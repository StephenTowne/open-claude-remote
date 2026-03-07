/**
 * Stop all instances by sending a shutdown request to the daemon.
 * Used by `pnpm stop` script.
 */
import { stopDaemon } from '../daemon/daemon-client.js';

export async function main(): Promise<void> {
  await stopDaemon();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
