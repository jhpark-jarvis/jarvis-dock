import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  readTelemetryFile,
  summarizeTelemetry,
} from './analyze-runtime-telemetry.mjs';

const processMetric = (workingSetSize) => ({
  pid: 10,
  type: 'Browser',
  memory: { workingSetSize, peakWorkingSetSize: workingSetSize },
});

test('summarizes action latency percentiles and memory deltas', () => {
  const records = [
    {
      kind: 'session',
      event: 'session-start',
      sessionId: 'test',
      mainMemory: { rss: 100, heapUsed: 40 },
      processes: [processMetric(200)],
    },
    {
      kind: 'action',
      event: 'editor-input-burst',
      details: { latencyMs: 10, durationMs: 20, outcome: 'success' },
      mainMemory: { rss: 120, heapUsed: 50 },
      processes: [processMetric(260)],
    },
    {
      kind: 'action',
      event: 'editor-input-burst',
      details: { latencyMs: 30, durationMs: 40, outcome: 'success' },
      mainMemory: { rss: 140, heapUsed: 70 },
      processes: [processMetric(300)],
    },
  ];
  const summary = summarizeTelemetry(records);

  assert.equal(summary.actionCount, 2);
  assert.deepEqual(summary.actions['editor-input-burst'].latencyMs, {
    count: 2,
    min: 10,
    average: 20,
    p50: 10,
    p95: 30,
    max: 30,
  });
  assert.equal(summary.memory.delta.mainRss, 40);
  assert.equal(summary.memory.delta.processes[0].workingSetSize, 100);
});

test('counts malformed JSONL rows without stopping the report', async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'dock-telemetry-test-'),
  );
  try {
    const filePath = path.join(directory, 'session.jsonl');
    await writeFile(
      filePath,
      '{"kind":"session","event":"session-start"}\nnot-json\n',
      'utf8',
    );
    const summary = await readTelemetryFile(filePath);
    assert.equal(summary.recordCount, 1);
    assert.equal(summary.invalidRecordCount, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
