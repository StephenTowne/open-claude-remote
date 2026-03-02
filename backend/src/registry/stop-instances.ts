import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { CLAUDE_REMOTE_DIR } from '@claude-remote/shared';
import type { InstanceInfo } from '@claude-remote/shared';
import { logger } from '../logger/logger.js';
import { InstanceRegistryManager } from './instance-registry.js';

export interface StopFailure {
  instanceId: string;
  name: string;
  port: number;
  pid: number;
  reason: string;
}

export interface StopSummary {
  total: number;
  stopped: number;
  failed: number;
  failures: StopFailure[];
}

export interface StopInstancesOptions {
  gracePeriodMs?: number;
  pollIntervalMs?: number;
  killSignal?: NodeJS.Signals;
  signalSender?: (pid: number, signal: NodeJS.Signals | 0) => void;
  sleep?: (ms: number) => Promise<void>;
  processVerifier?: (instance: InstanceInfo) => Promise<boolean> | boolean;
}

const DEFAULT_GRACE_PERIOD_MS = 5_000;
const DEFAULT_POLL_INTERVAL_MS = 200;

function createProcessVerifier(signalSender: (pid: number, signal: NodeJS.Signals | 0) => void): (instance: InstanceInfo) => boolean {
  return (instance: InstanceInfo) => {
    // 先确认 PID 仍存在
    try {
      signalSender(instance.pid, 0);
    } catch {
      return false;
    }

    // 再确认该 PID 仍在监听注册端口，降低 PID 复用误杀风险
    try {
      const output = execFileSync('lsof', ['-nP', `-iTCP:${instance.port}`, '-sTCP:LISTEN', '-Fp'], {
        encoding: 'utf-8',
      });
      const pids = output
        .split('\n')
        .filter((line) => line.startsWith('p'))
        .map((line) => Number(line.slice(1)))
        .filter((pid) => Number.isInteger(pid));
      return pids.includes(instance.pid);
    } catch (err) {
      logger.warn({ err, pid: instance.pid, port: instance.port }, 'Process verification via lsof failed, fallback to PID-only check');
      return true;
    }
  };
}

function createSleep(): (ms: number) => Promise<void> {
  return (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function createSignalSender(): (pid: number, signal: NodeJS.Signals | 0) => void {
  return (pid: number, signal: NodeJS.Signals | 0) => {
    process.kill(pid, signal);
  };
}

function createIsAlive(signalSender: (pid: number, signal: NodeJS.Signals | 0) => void): (pid: number) => boolean {
  return (pid: number) => {
    try {
      signalSender(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
}

async function waitForExit(
  pid: number,
  timeoutMs: number,
  pollIntervalMs: number,
  isAlive: (pid: number) => boolean,
  sleep: (ms: number) => Promise<void>,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) {
      return true;
    }
    await sleep(pollIntervalMs);
  }
  return !isAlive(pid);
}

export async function stopInstances(
  registry: InstanceRegistryManager,
  options: StopInstancesOptions = {},
): Promise<StopSummary> {
  const gracePeriodMs = options.gracePeriodMs ?? DEFAULT_GRACE_PERIOD_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const killSignal = options.killSignal ?? 'SIGKILL';
  const signalSender = options.signalSender ?? createSignalSender();
  const sleep = options.sleep ?? createSleep();
  const isAlive = createIsAlive(signalSender);
  const processVerifier = options.processVerifier ?? createProcessVerifier(signalSender);

  const instances = await registry.list();
  const summary: StopSummary = {
    total: instances.length,
    stopped: 0,
    failed: 0,
    failures: [],
  };

  logger.info({ total: instances.length }, 'Starting multi-instance stop');

  if (instances.length === 0) {
    logger.info('No active instances found, stop is idempotent');
    return summary;
  }

  for (const instance of instances) {
    const verified = await processVerifier(instance);
    if (!verified) {
      summary.failed += 1;
      summary.failures.push({
        instanceId: instance.instanceId,
        name: instance.name,
        port: instance.port,
        pid: instance.pid,
        reason: 'Process verification failed: pid/port mismatch',
      });
      logger.error({
        instanceId: instance.instanceId,
        name: instance.name,
        pid: instance.pid,
        port: instance.port,
      }, 'Skip stopping instance due to process verification failure');
      continue;
    }

    const result = await stopSingleInstance(instance, {
      gracePeriodMs,
      pollIntervalMs,
      killSignal,
      signalSender,
      sleep,
      isAlive,
    });

    if (result.ok) {
      summary.stopped += 1;
      registry.unregister(instance.instanceId);
      logger.info({
        instanceId: instance.instanceId,
        name: instance.name,
        pid: instance.pid,
        port: instance.port,
      }, 'Instance stopped');
    } else {
      summary.failed += 1;
      summary.failures.push({
        instanceId: instance.instanceId,
        name: instance.name,
        port: instance.port,
        pid: instance.pid,
        reason: result.reason,
      });
      logger.error({
        instanceId: instance.instanceId,
        name: instance.name,
        pid: instance.pid,
        port: instance.port,
        reason: result.reason,
      }, 'Failed to stop instance');
    }
  }

  logger.info({
    total: summary.total,
    stopped: summary.stopped,
    failed: summary.failed,
    failures: summary.failures,
  }, 'Multi-instance stop summary');

  return summary;
}

async function stopSingleInstance(
  instance: InstanceInfo,
  ctx: {
    gracePeriodMs: number;
    pollIntervalMs: number;
    killSignal: NodeJS.Signals;
    signalSender: (pid: number, signal: NodeJS.Signals | 0) => void;
    sleep: (ms: number) => Promise<void>;
    isAlive: (pid: number) => boolean;
  },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { gracePeriodMs, pollIntervalMs, killSignal, signalSender, sleep, isAlive } = ctx;

  try {
    signalSender(instance.pid, 'SIGTERM');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') {
      return { ok: true };
    }
    return { ok: false, reason: `SIGTERM failed: ${String(code ?? err)}` };
  }

  const exitedGracefully = await waitForExit(
    instance.pid,
    gracePeriodMs,
    pollIntervalMs,
    isAlive,
    sleep,
  );

  if (exitedGracefully) {
    return { ok: true };
  }

  logger.warn({
    instanceId: instance.instanceId,
    pid: instance.pid,
    killSignal,
  }, 'Graceful stop timed out, sending fallback signal');

  try {
    signalSender(instance.pid, killSignal);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') {
      return { ok: true };
    }
    return { ok: false, reason: `${killSignal} failed: ${String(code ?? err)}` };
  }

  const exitedAfterKill = await waitForExit(
    instance.pid,
    Math.max(pollIntervalMs * 2, 300),
    pollIntervalMs,
    isAlive,
    sleep,
  );

  if (!exitedAfterKill) {
    return { ok: false, reason: `Process still alive after ${killSignal}` };
  }

  return { ok: true };
}

export async function stopAllRegisteredInstances(options: StopInstancesOptions = {}): Promise<StopSummary> {
  const sharedConfigDir = resolve(homedir(), CLAUDE_REMOTE_DIR);
  const registry = new InstanceRegistryManager(sharedConfigDir);
  return stopInstances(registry, options);
}

export async function main(): Promise<void> {
  try {
    const summary = await stopAllRegisteredInstances();

    if (summary.failed > 0) {
      process.stderr.write(`Failed to stop ${summary.failed}/${summary.total} instance(s).\n`);
      for (const failure of summary.failures) {
        process.stderr.write(`- ${failure.name} (${failure.instanceId}, pid=${failure.pid}, port=${failure.port}): ${failure.reason}\n`);
      }
      process.exit(1);
    }

    process.stderr.write(`Stopped ${summary.stopped} instance(s).\n`);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Unexpected error while stopping instances');
    process.stderr.write(`Stop failed: ${String(err)}\n`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
