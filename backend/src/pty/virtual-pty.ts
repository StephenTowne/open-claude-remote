import { EventEmitter } from 'node:events';
import { WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '@claude-remote/shared';
import type { IPtyManager } from './types.js';
import { logger } from '../logger/logger.js';

/**
 * VirtualPtyManager 模拟 PtyManager 接口，
 * 但将写入操作通过 WebSocket 转发到远程实例。
 * 用于 attach 命令，让本地终端接管远程实例。
 */
export class VirtualPtyManager extends EventEmitter implements IPtyManager {
  private ws: WebSocket | null = null;
  private _cols: number = 80;
  private _rows: number = 24;
  private _connected: boolean = false;

  get cols(): number {
    return this._cols;
  }

  get rows(): number {
    return this._rows;
  }

  get connected(): boolean {
    return this._connected;
  }

  /**
   * 连接到远程实例的 WebSocket。
   */
  connect(url: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${url}?token=${encodeURIComponent(token)}`;
      logger.info({ url }, 'VirtualPtyManager: connecting to remote instance');

      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        logger.info('VirtualPtyManager: connected');
        this._connected = true;
        resolve();
      });

      this.ws.on('message', (rawData) => {
        try {
          const msg = JSON.parse(rawData.toString()) as ServerMessage;

          switch (msg.type) {
            case 'terminal_output':
              // 转发输出到本地终端
              this.emit('data', msg.data);
              break;

            case 'history_sync':
              // 历史数据也是输出
              this.emit('data', msg.data);
              // history_sync 包含服务端当前 PTY 尺寸
              // 作为从控端，attach 应该跟随服务端（webapp 主控端）的尺寸
              if (msg.cols && msg.rows && (msg.cols !== this._cols || msg.rows !== this._rows)) {
                const oldCols = this._cols;
                const oldRows = this._rows;
                this._cols = msg.cols;
                this._rows = msg.rows;
                logger.info(
                  { serverCols: msg.cols, serverRows: msg.rows, localCols: oldCols, localRows: oldRows },
                  'VirtualPtyManager: server size differs, updating local to match'
                );
                // 通知本地终端调整尺寸
                this.emit('resize', msg.cols, msg.rows);
              }
              break;

            case 'terminal_resize':
              // 服务端 PTY 尺寸变化通知
              // 作为从控端，attach 应该跟随 webapp（主控端）的尺寸
              if (msg.cols && msg.rows) {
                const sizeChanged = msg.cols !== this._cols || msg.rows !== this._rows;
                this._cols = msg.cols;
                this._rows = msg.rows;
                if (sizeChanged) {
                  // 通知本地终端调整尺寸
                  this.emit('resize', msg.cols, msg.rows);
                }
                logger.info(
                  { cols: msg.cols, rows: msg.rows },
                  'VirtualPtyManager: synced size from webapp (master)'
                );
              }
              break;

            case 'status_update':
              logger.info({ status: msg.status }, 'VirtualPtyManager: status update');
              break;

            case 'ip_changed':
              logger.info({ newUrl: msg.newUrl }, 'VirtualPtyManager: IP changed');
              break;

            default:
              // 忽略其他消息类型
              break;
          }
        } catch (err) {
          logger.warn({ err }, 'VirtualPtyManager: failed to parse server message');
        }
      });

      this.ws.on('close', () => {
        logger.info('VirtualPtyManager: connection closed');
        this._connected = false;
        this.emit('exit', 0);
      });

      this.ws.on('error', (err) => {
        logger.error({ err }, 'VirtualPtyManager: WebSocket error');
        const wasConnected = this._connected;
        this._connected = false;
        if (!wasConnected) {
          // 连接阶段的错误
          reject(err);
        } else {
          // 已连接后的错误
          this.emit('error', err);
        }
      });
    });
  }

  /**
   * 写入数据（发送到远程实例）。
   */
  write(data: string): void {
    if (!this.ws || !this._connected) {
      logger.warn('VirtualPtyManager: attempted to write but not connected');
      return;
    }

    const msg: ClientMessage = {
      type: 'user_input',
      data,
    };
    this.ws.send(JSON.stringify(msg));
  }

  /**
   * 调整终端大小。
   */
  resize(cols: number, rows: number): void {
    if (!this.ws || !this._connected) return;

    this._cols = cols;
    this._rows = rows;
    this.sendResize();
  }

  /**
   * 发送 resize 消息到服务端（内部方法）。
   */
  private sendResize(): void {
    if (!this.ws || !this._connected) return;

    const msg: ClientMessage = {
      type: 'resize',
      cols: this._cols,
      rows: this._rows,
    };
    this.ws.send(JSON.stringify(msg));
    logger.debug({ cols: this._cols, rows: this._rows }, 'VirtualPtyManager: resized');
  }

  /**
   * 断开连接。
   */
  destroy(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
    logger.info('VirtualPtyManager: destroyed');
  }
}