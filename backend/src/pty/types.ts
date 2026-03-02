/**
 * PTY 管理器接口
 * 支持本地 PtyManager 和远程 VirtualPtyManager
 */
export interface IPtyManager {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  cols: number;
  rows: number;
}