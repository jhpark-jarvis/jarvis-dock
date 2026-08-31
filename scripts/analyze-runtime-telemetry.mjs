import { readFile } from 'node:fs/promises';

const groupBy = (values, keySelector) => {
  const groups = {};
  for (const value of values) {
    const key = keySelector(value);
    groups[key] ??= [];
    groups[key].push(value);
  }
  return groups;
};

const percentile = (values, ratio) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );
  return sorted[index];
};

const numericValues = (records, key) =>
  records
    .map((record) => record.details?.[key])
    .filter((value) => typeof value === 'number' && Number.isFinite(value));

const summarizeValues = (values) => {
  if (values.length === 0) return null;
  return {
    count: values.length,
    min: Math.min(...values),
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    max: Math.max(...values),
  };
};

const memorySnapshot = (record) => ({
  mainRss: record.mainMemory?.rss ?? null,
  mainHeapUsed: record.mainMemory?.heapUsed ?? null,
  processes: (Array.isArray(record.processes) ? record.processes : []).map(
    (process) => ({
      pid: process.pid,
      type: process.type,
      workingSetSize: process.memory?.workingSetSize ?? null,
      privateBytes: process.memory?.privateBytes ?? null,
      peakWorkingSetSize: process.memory?.peakWorkingSetSize ?? null,
    }),
  ),
});

const memoryDelta = (first, last) => {
  if (!first || !last) return null;
  const delta = (left, right) =>
    typeof left === 'number' && typeof right === 'number' ? right - left : null;
  const firstProcesses = new Map(
    first.processes.map((process) => [process.pid, process]),
  );
  return {
    mainRss: delta(first.mainRss, last.mainRss),
    mainHeapUsed: delta(first.mainHeapUsed, last.mainHeapUsed),
    processes: last.processes.map((process) => {
      const previous = firstProcesses.get(process.pid);
      return {
        pid: process.pid,
        type: process.type,
        workingSetSize: delta(previous?.workingSetSize, process.workingSetSize),
        privateBytes: delta(previous?.privateBytes, process.privateBytes),
      };
    }),
  };
};

export const summarizeTelemetry = (records) => {
  const validRecords = records.filter(
    (record) =>
      record &&
      typeof record === 'object' &&
      typeof record.event === 'string' &&
      typeof record.kind === 'string',
  );
  const actions = validRecords.filter((record) => record.kind === 'action');
  const groupedActions = groupBy(actions, (record) => record.event);
  const actionSummary = Object.fromEntries(
    Object.entries(groupedActions).map(([event, eventRecords]) => [
      event,
      {
        count: eventRecords.length,
        outcomes: Object.fromEntries(
          Object.entries(
            groupBy(
              eventRecords,
              (record) => record.details?.outcome ?? 'unknown',
            ),
          ).map(([outcome, outcomeRecords]) => [
            outcome,
            outcomeRecords.length,
          ]),
        ),
        durationMs: summarizeValues(numericValues(eventRecords, 'durationMs')),
        latencyMs: summarizeValues(numericValues(eventRecords, 'latencyMs')),
      },
    ]),
  );
  const snapshots = validRecords.map(memorySnapshot);
  const firstSnapshot = snapshots[0] ?? null;
  const lastSnapshot = snapshots.at(-1) ?? null;
  return {
    recordCount: validRecords.length,
    actionCount: actions.length,
    invalidRecordCount: records.length - validRecords.length,
    session: {
      id: validRecords.find((record) => record.sessionId)?.sessionId ?? null,
      startedAt:
        validRecords.find((record) => record.event === 'session-start')
          ?.timestamp ?? null,
      endedAt:
        [...validRecords]
          .reverse()
          .find((record) => record.event === 'session-end')?.timestamp ?? null,
    },
    actions: actionSummary,
    memory: {
      first: firstSnapshot,
      last: lastSnapshot,
      delta: memoryDelta(firstSnapshot, lastSnapshot),
      peakMainRss: Math.max(
        0,
        ...snapshots
          .map((snapshot) => snapshot.mainRss)
          .filter((value) => typeof value === 'number'),
      ),
      peakProcessWorkingSetSize: Math.max(
        0,
        ...snapshots.flatMap((snapshot) =>
          snapshot.processes
            .map((process) => process.workingSetSize)
            .filter((value) => typeof value === 'number'),
        ),
      ),
    },
  };
};

export const readTelemetryFile = async (filePath) => {
  const source = await readFile(filePath, 'utf8');
  const records = [];
  let invalidRecordCount = 0;
  for (const line of source.split(/\r?\n/).filter(Boolean)) {
    try {
      records.push(JSON.parse(line));
    } catch {
      invalidRecordCount += 1;
    }
  }
  const summary = summarizeTelemetry(records);
  return {
    ...summary,
    invalidRecordCount: summary.invalidRecordCount + invalidRecordCount,
  };
};

if (process.argv[1]?.endsWith('analyze-runtime-telemetry.mjs')) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error(
      '사용법: node scripts/analyze-runtime-telemetry.mjs <jsonl-path>',
    );
    process.exitCode = 1;
  } else {
    try {
      console.log(JSON.stringify(await readTelemetryFile(filePath), null, 2));
    } catch (error) {
      console.error(`telemetry 분석 실패: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
