import { WebSocket } from 'ws';
import type { ClientMessage } from '@claude-remote/shared';
import { logger } from '../logger/logger.js';

export interface WsHandlerCallbacks {
  onUserInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
}

/**
 * Parse and route incoming WebSocket messages.
 */
export function handleWsMessage(ws: WebSocket, raw: string, callbacks: WsHandlerCallbacks): void {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw) as ClientMessage;
  } catch {
    logger.warn({ raw: raw.substring(0, 200) }, 'Invalid JSON in WS message');
    return;
  }

  switch (msg.type) {
    case 'user_input':
      if (typeof msg.data === 'string') {
        callbacks.onUserInput(msg.data);
      }
      break;

    case 'resize':
      if (typeof msg.cols === 'number' && typeof msg.rows === 'number') {
        callbacks.onResize(msg.cols, msg.rows);
      }
      break;

    case 'heartbeat':
      // Reply with server heartbeat
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
      }
      break;

    default:
      logger.warn({ type: (msg as { type?: string }).type }, 'Unknown WS message type');
  }
}
