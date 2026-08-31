import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  RuntimeEventName,
  RuntimeRecordEventRequest,
} from '../shared/ipc';

export interface RuntimeProcessMetric {
  pid: number;
  type: string;
  name?: string;
  serviceName?: string;
  memory: {
    workingSetSize: number;
    privateBytes?: number;
    peakWorkingSetSize: number;
  };
  cpuPercent?: number;
}

export interface RuntimeMainMemory {
  rss: number;
  heapUsed: number;
  external: number;
}

export interface RuntimeTelemetryDependencies {
  logDirectory: string;
  getMetrics: () => readonly RuntimeProcessMetric[];
  getMainMemory: () => RuntimeMainMemory;
  enabled?: boolean;
  intervalMs?: number;
  now?: () => number;
  sessionId?: string;
}

type RuntimeRecord = {
  timestamp: string;
  sessionId: string;
  elapsedMs: number;
  kind: 'session' | 'sample' | 'action';
  event: string;
  mainMemory: RuntimeMainMemory;
  processes: Array<{
    pid: number;
    type: string;
    name?: string;
    serviceName?: string;
    cpuPercent?: number;
    memory: RuntimeProcessMetric['memory'];
  }>;
  details?: RuntimeRecordEventRequest['details'];
};

const safeMetrics = (
  metrics: readonly RuntimeProcessMetric[],
): RuntimeRecord['processes'] =>
  metrics.map(({ pid, type, name, serviceName, memory, cpuPercent }) => ({
    pid,
    type,
    ...(name ? { name } : {}),
    ...(serviceName ? { serviceName } : {}),
    ...(cpuPercent === undefined ? {} : { cpuPercent }),
    memory,
  }));

export class RuntimeTelemetry {
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private readonly now: () => number;
  private readonly sessionId: string;
  private readonly startedAt: number;
  private readonly logPath: string;
  private interval: ReturnType<typeof setInterval> | undefined;
  private writeQueue = Promise.resolve();

  constructor(private readonly dependencies: RuntimeTelemetryDependencies) {
    this.enabled = dependencies.enabled ?? true;
    this.intervalMs = dependencies.intervalMs ?? 5_000;
    this.now = dependencies.now ?? Date.now;
    this.sessionId = dependencies.sessionId ?? randomUUID();
    this.startedAt = this.now();
    this.logPath = path.join(
      dependencies.logDirectory,
      `dock-runtime-${this.sessionId}.jsonl`,
    );
  }

  get filePath(): string {
    return this.logPath;
  }

  start(): void {
    if (!this.enabled || this.interval) return;
    this.enqueue('session', 'session-start');
    this.interval = setInterval(() => {
      this.enqueue('sample', 'interval');
    }, this.intervalMs);
    this.interval.unref?.();
  }

  recordAction(
    event: RuntimeEventName,
    details?: RuntimeRecordEventRequest['details'],
  ): void {
    if (!this.enabled) return;
    this.enqueue('action', event, details);
  }

  stop(): void {
    if (!this.enabled) return;
    if (this.interval) clearInterval(this.interval);
    this.interval = undefined;
    this.enqueue('session', 'session-end');
  }

  flush(): Promise<void> {
    return this.writeQueue;
  }

  private enqueue(
    kind: RuntimeRecord['kind'],
    event: string,
    details?: RuntimeRecordEventRequest['details'],
  ): void {
    const timestamp = this.now();
    const record: RuntimeRecord = {
      timestamp: new Date(timestamp).toISOString(),
      sessionId: this.sessionId,
      elapsedMs: Math.max(0, timestamp - this.startedAt),
      kind,
      event,
      mainMemory: this.dependencies.getMainMemory(),
      processes: safeMetrics(this.dependencies.getMetrics()),
      ...(details ? { details } : {}),
    };
    const line = `${JSON.stringify(record)}\n`;
    this.writeQueue = this.writeQueue
      .then(async () => {
        await mkdir(this.dependencies.logDirectory, { recursive: true });
        await appendFile(this.logPath, line, 'utf8');
      })
      .catch(() => undefined);
  }
}
