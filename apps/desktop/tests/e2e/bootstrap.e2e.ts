import { _electron as electron, expect, test } from '@playwright/test';
import electronExecutablePathModule from 'electron';
import path from 'node:path';

const desktopDirectory = path.resolve(__dirname, '../..');
const electronExecutablePath =
  electronExecutablePathModule as unknown as string;

const launchDock = () => {
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;

  return electron.launch({
    executablePath: electronExecutablePath,
    args: ['.'],
    cwd: desktopDirectory,
    env: environment,
  });
};

test('Dock starts with a narrow preload API and no Renderer Node.js globals', async () => {
  const app = await launchDock();

  try {
    const page = await app.firstWindow();

    await expect(page).toHaveTitle('Dock');
    await expect(page.getByRole('heading', { name: 'Dock' })).toBeVisible();

    const rendererState = await page.evaluate(async () => {
      const health = await window.dock.system.health();
      const version = await window.dock.system.version();

      return {
        dockKeys: Object.keys(window.dock),
        health,
        version,
        processType: typeof (window as Window & { process?: unknown }).process,
        requireType: typeof (window as Window & { require?: unknown }).require,
      };
    });

    expect(await app.windows()).toHaveLength(1);
    expect(rendererState.dockKeys).toEqual(['system']);
    expect(rendererState.health).toEqual({ ok: true, value: { status: 'ok' } });
    expect(rendererState.version).toEqual({
      ok: true,
      value: { version: '1.0.0' },
    });
    expect(rendererState.processType).toBe('undefined');
    expect(rendererState.requireType).toBe('undefined');
  } finally {
    await app.close();
  }
});

test('Dock blocks navigation away from the approved Renderer URL', async () => {
  const app = await launchDock();

  try {
    const page = await app.firstWindow();
    const initialUrl = page.url();

    await page.evaluate(() => {
      window.location.assign('https://example.com/');
    });
    await page.waitForTimeout(250);

    const currentUrl = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.webContents.getURL(),
    );

    expect(currentUrl).toBe(initialUrl);
    expect(await app.windows()).toHaveLength(1);
  } finally {
    await app.close();
  }
});
