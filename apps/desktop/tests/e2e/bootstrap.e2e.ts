import { _electron as electron, expect, test } from '@playwright/test';
import electronExecutablePathModule from 'electron';
import path from 'node:path';

const desktopDirectory = path.resolve(__dirname, '../..');
const electronExecutablePath =
  electronExecutablePathModule as unknown as string;

const launchDock = (extraArgs: string[] = []) => {
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;

  return electron.launch({
    executablePath: electronExecutablePath,
    args: ['.', ...extraArgs],
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
    expect(rendererState.dockKeys).toEqual([
      'system',
      'workspace',
      'document',
      'research',
      'image',
    ]);
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

test('Dock opens Research View and inserts the current verified link', async () => {
  const app = await launchDock(['--dock-e2e-link']);

  try {
    const page = await app.firstWindow();
    const editor = page.getByRole('textbox', { name: 'Markdown 편집기' });
    await expect(editor).toHaveValue('# Start');

    await page.getByRole('button', { name: '명령 팔레트 열기' }).click();
    await page.getByRole('button', { name: /\/link/ }).click();
    await page.getByRole('textbox', { name: '링크 검색어' }).fill('electron');
    await page.getByRole('button', { name: 'Research View 열기' }).click();
    await expect(page.getByRole('status')).toContainText(
      'Research View가 오른쪽 영역에서 열려 있습니다.',
    );
    await page.getByRole('button', { name: '현재 페이지 링크 삽입' }).click();

    await expect(editor).toHaveValue(
      '# Start[Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)',
    );
  } finally {
    await app.close();
  }
});

test('Dock completes the mock /image search and keeps the document unchanged', async () => {
  const app = await launchDock(['--dock-e2e-image']);

  try {
    const page = await app.firstWindow();
    const editor = page.getByRole('textbox', { name: 'Markdown 편집기' });
    await expect(editor).toHaveValue('# Start');

    await page.getByRole('button', { name: '명령 팔레트 열기' }).click();
    await page.getByRole('button', { name: /\/image/ }).click();
    await page.getByRole('textbox', { name: '이미지 검색어' }).fill('electron');
    await page.getByRole('button', { name: '검색' }).click();
    await page.getByRole('button', { name: /Electron process model/ }).click();

    await expect(page.getByRole('status')).toContainText(
      'Electron process model을(를) 선택했습니다.',
    );
    await expect(
      page.getByRole('button', { name: '다운로드 및 삽입' }),
    ).toBeVisible();
    await expect(editor).toHaveValue('# Start');
  } finally {
    await app.close();
  }
});

test('Dock downloads the selected image before inserting Markdown', async () => {
  const app = await launchDock(['--dock-e2e-image']);

  try {
    const page = await app.firstWindow();
    const editor = page.getByRole('textbox', { name: 'Markdown 편집기' });

    await page.getByRole('button', { name: '명령 팔레트 열기' }).click();
    await page.getByRole('button', { name: /\/image/ }).click();
    await page.getByRole('textbox', { name: '이미지 검색어' }).fill('electron');
    await page.getByRole('button', { name: '검색' }).click();
    await page.getByRole('button', { name: /Electron process model/ }).click();
    await page.getByRole('button', { name: '다운로드 및 삽입' }).click();

    await expect(editor).toHaveValue(
      '# Start![Electron process model](./assets/electron-process-model.png)',
    );
  } finally {
    await app.close();
  }
});
