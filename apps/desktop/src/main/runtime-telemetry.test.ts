import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RuntimeTelemetry,
  type RuntimeProcessMetric,
} from './runtime-telemetry';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const metric: RuntimeProcessMetric = {
  pid: 123,
  type: 'Browser',
  name: 'browser',
  memory: {
    workingSetSize: 40_000,
    privateBytes: 30_000,
    peakWorkingSetSize: 45_000,
  },
  cpuPercent: 1.5,
};

describe('RuntimeTelemetry', () => {
  it('writes session, action, and process memory snapshots as JSONL', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'dock-runtime-'));
    temporaryDirectories.push(directory);
    let now = 1_000;
    const telemetry = new RuntimeTelemetry({
      logDirectory: directory,
      getMetrics: () => [metric],
      getMainMemory: () => ({ rss: 100, heapUsed: 50, external: 10 }),
      intervalMs: 60_000,
      sessionId: 'test-session',
      now: () => now,
    });

    telemetry.start();
    now = 1_250;
    telemetry.recordAction('editor-input-burst', {
      count: 4,
      latencyMs: 12,
      outcome: 'success',
    });
    telemetry.stop();
    await telemetry.flush();

    const records = (await readFile(telemetry.filePath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(records).toHaveLength(3);
    expect(records.map((record) => record.event)).toEqual([
      'session-start',
      'editor-input-burst',
      'session-end',
    ]);
    expect(records[1]).toMatchObject({
      kind: 'action',
      elapsedMs: 250,
      details: { count: 4, latencyMs: 12, outcome: 'success' },
      mainMemory: { rss: 100 },
      processes: [{ pid: 123, memory: { workingSetSize: 40_000 } }],
    });
  });

  it('does not create a log when telemetry is disabled', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'dock-runtime-'));
    temporaryDirectories.push(directory);
    const telemetry = new RuntimeTelemetry({
      enabled: false,
      logDirectory: directory,
      getMetrics: () => [],
      getMainMemory: () => ({ rss: 0, heapUsed: 0, external: 0 }),
      sessionId: 'disabled',
    });

    telemetry.start();
    telemetry.recordAction('workspace-selected');
    telemetry.stop();
    await telemetry.flush();

    await expect(readFile(telemetry.filePath, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
