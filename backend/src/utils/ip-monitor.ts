import { detectLanIp, detectNonLoopbackIp, getAllNetworkInterfaces, type NetworkInterface } from './network.js';
import { logger } from '../logger/logger.js';

export type IpChangeCallback = (newIp: string, oldIp: string) => void;
export type NetworkChangeCallback = (interfaces: NetworkInterface[], preferredIp: string) => void;
export type GetIpFunction = () => string | null;

/**
 * 默认的 IP 检测函数：优先使用 LAN IP，其次使用非回环 IP
 */
function defaultGetIp(): string | null {
  return detectLanIp() ?? detectNonLoopbackIp();
}

/**
 * 序列化接口列表，用于比对变化
 */
function serializeInterfaces(interfaces: NetworkInterface[]): string {
  return interfaces
    .map(i => `${i.name}:${i.address}`)
    .sort()
    .join(',');
}

/**
 * IP 变化监控器。
 *
 * 采用轮询检测 + 稳定性阈值策略：
 * - 每隔 intervalMs 检测一次 IP
 * - 连续 stabilityThreshold 次检测到相同新 IP 才触发回调
 * - 避免短暂网络波动导致误报
 *
 * 增强功能：同时监控所有网络接口的变化
 */
export class IpMonitor {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private pendingIp: string | null = null;
  private stabilityCount = 0;
  private _currentIp: string = '';
  private _currentInterfaces: NetworkInterface[] = [];
  private pendingInterfaces: NetworkInterface[] | null = null;
  private interfaceStabilityCount = 0;

  constructor(
    private readonly onChange: IpChangeCallback,
    private readonly intervalMs = 30000,
    private readonly stabilityThreshold = 2,
    private readonly getIp: GetIpFunction = defaultGetIp,
    private readonly onNetworkChange?: NetworkChangeCallback,
  ) {}

  /**
   * 启动 IP 监控。
   * @param initialIp 初始 IP 地址
   */
  start(initialIp: string): void {
    this.stop();
    this._currentIp = initialIp;
    this.pendingIp = null;
    this.stabilityCount = 0;
    this._currentInterfaces = getAllNetworkInterfaces();
    this.pendingInterfaces = null;
    this.interfaceStabilityCount = 0;

    this.intervalId = setInterval(() => {
      this.check();
      this.checkInterfaces();
    }, this.intervalMs);

    // 允许 Node.js 事件循环在没有其他活动时退出
    if (this.intervalId.unref) {
      this.intervalId.unref();
    }

    logger.info({ initialIp, interfaces: this._currentInterfaces.length, intervalMs: this.intervalMs }, 'IP monitor started');
  }

  /**
   * 停止 IP 监控。
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.pendingIp = null;
    this.stabilityCount = 0;
  }

  /**
   * 检测 IP 变化。
   */
  private check(): void {
    const newIp = this.getIp();

    // 网络断开时不处理
    if (!newIp) {
      return;
    }

    // IP 未变化，重置待确认状态
    if (newIp === this._currentIp) {
      if (this.pendingIp !== null) {
        logger.debug('IP stabilized to original, resetting monitor state');
      }
      this.pendingIp = null;
      this.stabilityCount = 0;
      return;
    }

    // IP 变化了
    if (newIp === this.pendingIp) {
      // 与上次检测到的新 IP 相同，增加稳定性计数
      this.stabilityCount++;
      logger.debug({
        pendingIp: this.pendingIp,
        stabilityCount: this.stabilityCount,
        threshold: this.stabilityThreshold,
      }, 'IP change detected, counting stability');
    } else {
      // 检测到不同的新 IP，重置稳定性计数
      this.pendingIp = newIp;
      this.stabilityCount = 1;
      logger.debug({
        newIp,
      }, 'New IP detected, waiting for stability');
    }

    // 达到稳定性阈值，触发回调
    if (this.stabilityCount >= this.stabilityThreshold) {
      const oldIp = this._currentIp;
      this._currentIp = newIp;
      this.pendingIp = null;
      this.stabilityCount = 0;

      logger.info({ oldIp, newIp }, 'IP change confirmed, triggering callback');
      this.onChange(newIp, oldIp);
    }
  }

  /**
   * 检测网络接口列表变化。
   */
  private checkInterfaces(): void {
    // 如果没有网络变化回调，跳过此检查
    if (!this.onNetworkChange) return;

    const newInterfaces = getAllNetworkInterfaces();
    const currentSerialized = serializeInterfaces(this._currentInterfaces);
    const newSerialized = serializeInterfaces(newInterfaces);

    // 接口列表未变化
    if (newSerialized === currentSerialized) {
      if (this.pendingInterfaces !== null) {
        logger.debug('Network interfaces stabilized to original');
      }
      this.pendingInterfaces = null;
      this.interfaceStabilityCount = 0;
      return;
    }

    // 接口列表变化了
    if (this.pendingInterfaces && serializeInterfaces(this.pendingInterfaces) === newSerialized) {
      // 与上次检测到的新列表相同，增加稳定性计数
      this.interfaceStabilityCount++;
      logger.debug({
        stabilityCount: this.interfaceStabilityCount,
        threshold: this.stabilityThreshold,
      }, 'Network interface change detected, counting stability');
    } else {
      // 检测到不同的新列表，重置稳定性计数
      this.pendingInterfaces = newInterfaces;
      this.interfaceStabilityCount = 1;
      logger.debug({
        interfaces: newInterfaces.map(i => `${i.name}:${i.address}`),
      }, 'New network interfaces detected, waiting for stability');
    }

    // 达到稳定性阈值，触发回调
    if (this.interfaceStabilityCount >= this.stabilityThreshold) {
      this._currentInterfaces = newInterfaces;
      this.pendingInterfaces = null;
      this.interfaceStabilityCount = 0;

      logger.info({
        interfaces: newInterfaces.map(i => `${i.name}:${i.address}`),
      }, 'Network interface change confirmed, triggering callback');

      this.onNetworkChange(newInterfaces, this._currentIp);
    }
  }

  /**
   * 获取当前 IP。
   */
  get currentIp(): string {
    return this._currentIp;
  }

  /**
   * 获取当前所有网络接口。
   */
  get currentInterfaces(): NetworkInterface[] {
    return [...this._currentInterfaces];
  }
}