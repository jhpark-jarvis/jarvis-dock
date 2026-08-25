import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.GITHUB_ACTIONS ? 'github' : 'list',
  use: {
    trace: 'retain-on-failure',
  },
});
