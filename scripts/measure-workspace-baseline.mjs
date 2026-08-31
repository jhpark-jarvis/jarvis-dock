import { opendir, realpath } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  'coverage',
  '.cache',
  '.vite',
  '.next',
  '.nuxt',
  '.parcel-cache',
  '.serverless',
  '.webpack',
  'test-results',
  'playwright-report',
  'lib-cov',
  '.nyc_output',
  'jspm_packages',
]);

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/measure-workspace-baseline.mjs <path>');
  process.exitCode = 1;
} else {
  const root = await realpath(path.resolve(inputPath));
  const startedAt = performance.now();
  const memoryBefore = process.memoryUsage();
  const result = {
    root,
    directories: 0,
    files: 0,
    markdownFiles: 0,
    ignoredDirectories: 0,
    ignoredDirectoriesByName: {},
    maxDepth: 0,
  };

  const scan = async (currentPath, depth) => {
    result.maxDepth = Math.max(result.maxDepth, depth);
    const directory = await opendir(currentPath);
    for await (const entry of directory) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        if (DEFAULT_IGNORED_DIRECTORIES.has(entry.name)) {
          result.ignoredDirectories += 1;
          result.ignoredDirectoriesByName[entry.name] =
            (result.ignoredDirectoriesByName[entry.name] ?? 0) + 1;
          continue;
        }
        result.directories += 1;
        await scan(path.join(currentPath, entry.name), depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      result.files += 1;
      if (/\.(md|markdown)$/i.test(entry.name)) result.markdownFiles += 1;
    }
  };

  await scan(root, 0);
  const finishedAt = performance.now();
  const memoryAfter = process.memoryUsage();
  const recursiveWatcherSupported =
    process.platform === 'win32' || process.platform === 'darwin';
  console.log(
    JSON.stringify(
      {
        ...result,
        watcherStrategy: recursiveWatcherSupported
          ? 'recursive'
          : 'directory-fallback',
        estimatedWatcherCount: recursiveWatcherSupported
          ? 1
          : result.directories + 1,
        elapsedMs: Math.round((finishedAt - startedAt) * 100) / 100,
        rssBeforeMb: Math.round((memoryBefore.rss / 1024 / 1024) * 100) / 100,
        rssAfterMb: Math.round((memoryAfter.rss / 1024 / 1024) * 100) / 100,
        rssDeltaMb:
          Math.round(
            ((memoryAfter.rss - memoryBefore.rss) / 1024 / 1024) * 100,
          ) / 100,
        heapUsedBeforeMb:
          Math.round((memoryBefore.heapUsed / 1024 / 1024) * 100) / 100,
        heapUsedAfterMb:
          Math.round((memoryAfter.heapUsed / 1024 / 1024) * 100) / 100,
        heapUsedDeltaMb:
          Math.round(
            ((memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024) *
              100,
          ) / 100,
      },
      null,
      2,
    ),
  );
}
