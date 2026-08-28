import { _electron as electron, expect, test } from '@playwright/test';
import electronExecutablePathModule from 'electron';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const desktopDirectory = path.resolve(__dirname, '../..');
const electronExecutablePath =
  electronExecutablePathModule as unknown as string;
const LARGE_MARKDOWN_CONTENT = `# Large document\n\n${Array.from(
  { length: 6_000 },
  (_, index) => `## Section ${index + 1}\n\nLarge Markdown regression content.`,
).join('\n\n')}`;
const PNG_IMAGE_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const DOCK_SAMPLE_MARKDOWN = '![dock-sample](./assets/dock-sample.png)';

const launchDock = (
  extraArgs: string[] = [],
  extraEnvironment: NodeJS.ProcessEnv = {},
) => {
  const environment = { ...process.env, ...extraEnvironment };
  delete environment.ELECTRON_RUN_AS_NODE;

  return electron.launch({
    executablePath: electronExecutablePath,
    args: ['.', ...extraArgs],
    cwd: desktopDirectory,
    env: environment,
  });
};

test('Dock opens a large Markdown document without truncating the editor value', async () => {
  test.setTimeout(45_000);
  const workspaceRoot = mkdtempSync(
    path.join(os.tmpdir(), 'dock-e2e-large-document-'),
  );
  writeFileSync(
    path.join(workspaceRoot, 'large.md'),
    LARGE_MARKDOWN_CONTENT,
    'utf8',
  );
  mkdirSync(path.join(workspaceRoot, 'assets'));
  writeFileSync(
    path.join(workspaceRoot, 'assets', 'dock-sample.png'),
    PNG_IMAGE_BYTES,
  );
  const app = await launchDock(['--dock-e2e-document'], {
    DOCK_E2E_DOCUMENT_WORKSPACE_ROOT: workspaceRoot,
  });

  try {
    const page = await app.firstWindow();
    const editor = page.getByRole('textbox', { name: 'Markdown 편집기' });
    await page.getByRole('button', { name: '폴더 선택' }).click();
    await page.getByRole('button', { name: 'large.md' }).click();

    await expect(
      page.getByRole('heading', { name: 'Large document' }),
    ).toBeVisible();
    await page.getByRole('button', { name: '문서 개요 열기' }).click();
    await expect(
      page.getByRole('complementary', { name: '문서 개요' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Large document #1$/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: '이미지 자산 열기' }).click();
    await expect(
      page.getByRole('complementary', { name: '이미지 자산' }),
    ).toBeVisible();
    const assetButton = page.getByRole('button', {
      name: /dock-sample\.png assets\/dock-sample\.png/,
    });
    await expect(assetButton).toBeVisible();
    await assetButton.click();
    await expect
      .poll(async () =>
        editor.evaluate(
          (element, suffix) =>
            (element as HTMLTextAreaElement).value.includes(suffix),
          DOCK_SAMPLE_MARKDOWN,
        ),
      )
      .toBe(true);
    expect(
      await editor.evaluate(
        (element) => (element as HTMLTextAreaElement).value.length,
      ),
    ).toBe(LARGE_MARKDOWN_CONTENT.length + DOCK_SAMPLE_MARKDOWN.length);
  } finally {
    await app.close();
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test('Dock collapses and reopens the Explorer without hiding the editor or preview', async () => {
  const app = await launchDock();

  try {
    const page = await app.firstWindow();
    const editor = page.getByRole('textbox', { name: 'Markdown 편집기' });
    const preview = page.getByRole('region', { name: '미리보기' });
    const expandedEditorBox = await editor.boundingBox();
    expect(expandedEditorBox).not.toBeNull();

    await expect(
      page.getByRole('complementary', { name: '문서' }),
    ).toBeVisible();
    await page.getByRole('button', { name: '탐색기 패널 접기' }).click();

    await expect(
      page.getByRole('complementary', { name: '문서' }),
    ).not.toBeVisible();
    await expect(page.locator('.workspace-layout')).toHaveClass(
      /workspace-layout--explorer-collapsed/,
    );
    await expect(
      page.getByRole('button', { name: '탐색기 열기', exact: true }),
    ).toHaveAttribute('aria-expanded', 'false');
    await expect(editor).toBeVisible();
    await expect(preview).toBeVisible();
    const collapsedEditorBox = await editor.boundingBox();
    expect(collapsedEditorBox).not.toBeNull();
    if (!expandedEditorBox || !collapsedEditorBox) {
      throw new Error('Editor bounds are required.');
    }
    expect(collapsedEditorBox.width).toBeGreaterThan(expandedEditorBox.width);

    await page
      .getByRole('button', { name: '탐색기 열기', exact: true })
      .click();
    await expect(
      page.getByRole('complementary', { name: '문서' }),
    ).toBeVisible();
    await expect(page.locator('.workspace-layout')).not.toHaveClass(
      /workspace-layout--explorer-collapsed/,
    );
    await expect(
      page.getByRole('button', { name: '탐색기', exact: true }),
    ).toHaveAttribute('aria-expanded', 'true');
  } finally {
    await app.close();
  }
});

test('Dock returns to the empty state when document workspace selection is cancelled', async () => {
  const app = await launchDock(['--dock-e2e-document-cancel']);

  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: '폴더 선택' }).click();

    await expect(page.getByText('선택된 폴더가 없습니다.')).toBeVisible();
    const result = await page.evaluate(() => window.dock.workspace.choose());
    expect(result).toEqual({
      ok: false,
      error: { code: 'CANCELLED', message: 'Folder selection was cancelled.' },
    });
  } finally {
    await app.close();
  }
});

test('Dock preserves unsaved Markdown when the document write fails', async () => {
  const workspaceRoot = mkdtempSync(
    path.join(os.tmpdir(), 'dock-e2e-document-write-failure-'),
  );
  writeFileSync(path.join(workspaceRoot, 'guide.md'), '# Before', 'utf8');
  const app = await launchDock(['--dock-e2e-document-write-failure'], {
    DOCK_E2E_DOCUMENT_WORKSPACE_ROOT: workspaceRoot,
  });

  try {
    const page = await app.firstWindow();
    const editor = page.getByRole('textbox', { name: 'Markdown 편집기' });
    await page.getByRole('button', { name: '폴더 선택' }).click();
    await page.getByRole('button', { name: 'guide.md' }).click();
    await expect(editor).toHaveValue('# Before');
    await editor.fill('# After');
    await page.getByRole('button', { name: '저장' }).click();

    await expect(page.getByRole('alert')).toHaveText(
      '문서를 저장하지 못했습니다. 편집 내용은 유지됩니다.',
    );
    await expect(editor).toHaveValue('# After');
    await expect(page.getByRole('button', { name: '저장' })).toBeEnabled();
    expect(readFileSync(path.join(workspaceRoot, 'guide.md'), 'utf8')).toBe(
      '# Before',
    );
  } finally {
    await app.close();
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test('Dock selects, creates, saves, and reopens a document workspace after relaunch', async () => {
  const workspaceRoot = mkdtempSync(
    path.join(os.tmpdir(), 'dock-e2e-document-'),
  );
  writeFileSync(path.join(workspaceRoot, 'guide.md'), '# Start', 'utf8');
  const launchEnvironment = {
    DOCK_E2E_DOCUMENT_WORKSPACE_ROOT: workspaceRoot,
  };
  let firstApp: Awaited<ReturnType<typeof launchDock>> | undefined;
  let secondApp: Awaited<ReturnType<typeof launchDock>> | undefined;

  try {
    firstApp = await launchDock(['--dock-e2e-document'], launchEnvironment);
    const firstPage = await firstApp.firstWindow();
    const editor = firstPage.getByRole('textbox', { name: 'Markdown 편집기' });

    await firstPage.getByRole('button', { name: '폴더 선택' }).click();
    await firstPage.getByRole('button', { name: 'guide.md' }).click();
    await expect(editor).toHaveValue('# Start');

    await firstPage.getByLabel('새 문서 경로').fill('relaunch.md');
    await firstPage.getByRole('button', { name: '새 문서 생성' }).click();
    await expect(
      firstPage.getByRole('heading', { name: 'relaunch.md' }),
    ).toBeVisible();
    await editor.fill('# Relaunch\n\n저장된 Markdown 문서');
    await firstPage.getByRole('button', { name: '저장' }).click();
    await expect(
      firstPage.getByRole('button', { name: '저장됨' }),
    ).toBeDisabled();

    await firstApp.close();
    firstApp = undefined;

    secondApp = await launchDock(['--dock-e2e-document'], launchEnvironment);
    const secondPage = await secondApp.firstWindow();
    await secondPage.getByRole('button', { name: '폴더 선택' }).click();
    await secondPage.getByRole('button', { name: 'relaunch.md' }).click();
    await expect(
      secondPage.getByRole('textbox', { name: 'Markdown 편집기' }),
    ).toHaveValue('# Relaunch\n\n저장된 Markdown 문서');
  } finally {
    await firstApp?.close();
    await secondApp?.close();
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test('Dock initializes an Architecture Workspace without overwriting existing documents', async () => {
  const workspaceRoot = mkdtempSync(
    path.join(os.tmpdir(), 'dock-e2e-architecture-workspace-'),
  );
  const app = await launchDock(['--dock-e2e-document'], {
    DOCK_E2E_DOCUMENT_WORKSPACE_ROOT: workspaceRoot,
  });

  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: '폴더 선택' }).click();
    await page.getByRole('button', { name: '명령 팔레트 열기' }).click();
    await page.getByRole('button', { name: /Architecture Workspace/ }).click();
    await page.getByLabel('프로젝트명').fill('Dock');
    await page
      .getByLabel('프로젝트 목적')
      .fill('로컬 Markdown 기술 문서를 작성하고 관리합니다.');
    await page.getByLabel('주요 기술 스택').fill('Electron, React, TypeScript');
    await page.getByRole('button', { name: '문서 세트 생성' }).click();

    await expect(
      page.getByRole('heading', { name: 'docs/architecture/arc42.md' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'arc42.md' })).toBeVisible();
    expect(
      readFileSync(
        path.join(workspaceRoot, 'docs/architecture/c4-context.md'),
        'utf8',
      ),
    ).toContain('C4Context');
    expect(
      readFileSync(
        path.join(workspaceRoot, 'docs/adr/0001-initial-architecture.md'),
        'utf8',
      ),
    ).toContain('Dock 초기 아키텍처 문서 세트');
    await page.getByRole('button', { name: '명령 팔레트 열기' }).click();
    await page.getByRole('button', { name: /Architecture Workspace/ }).click();
    await page.getByRole('button', { name: '문서 정합성 점검' }).click();
    await expect(page.getByRole('status')).toContainText(
      '문서 세트가 정상입니다.',
    );
  } finally {
    await app.close();
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test('Dock creates numbered ADRs and updates the ADR index', async () => {
  const workspaceRoot = mkdtempSync(
    path.join(os.tmpdir(), 'dock-e2e-adr-create-'),
  );
  const app = await launchDock(['--dock-e2e-document'], {
    DOCK_E2E_DOCUMENT_WORKSPACE_ROOT: workspaceRoot,
  });

  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: '폴더 선택' }).click();
    await page.getByRole('button', { name: '명령 팔레트 열기' }).click();
    await page.getByRole('button', { name: 'ADR 작성' }).click();
    await page.getByLabel('결정 제목').fill('Add ADR workflow');
    await page.getByLabel('상태', { exact: true }).selectOption('Accepted');
    await page
      .getByLabel('배경')
      .fill('Architecture decisions need a durable record.');
    await page
      .getByLabel('결정', { exact: true })
      .fill('Create a numbered ADR and update the index.');
    await page
      .getByLabel('결과')
      .fill('Decisions remain discoverable in the document workspace.');
    await page.getByRole('button', { name: 'ADR 생성' }).click();

    await expect(
      page.getByRole('heading', { name: 'docs/adr/0001-add-adr-workflow.md' }),
    ).toBeVisible();
    expect(
      readFileSync(
        path.join(workspaceRoot, 'docs/adr/0001-add-adr-workflow.md'),
        'utf8',
      ),
    ).toContain('# ADR-0001: Add ADR workflow');
    expect(
      readFileSync(path.join(workspaceRoot, 'docs/adr/README.md'), 'utf8'),
    ).toContain('0001-add-adr-workflow.md');

    await page.getByRole('button', { name: '명령 팔레트 열기' }).click();
    await page.getByRole('button', { name: 'ADR 작성' }).click();
    await page.getByLabel('결정 제목').fill('Refine ADR index');
    await page.getByLabel('배경').fill('The first ADR is already present.');
    await page
      .getByLabel('결정', { exact: true })
      .fill('Append later ADRs without changing history.');
    await page.getByLabel('결과').fill('The index lists both decisions.');
    await page.getByRole('button', { name: 'ADR 생성' }).click();

    await expect(
      page.getByRole('heading', { name: 'docs/adr/0002-refine-adr-index.md' }),
    ).toBeVisible();
    expect(
      readFileSync(path.join(workspaceRoot, 'docs/adr/README.md'), 'utf8'),
    ).toEqual(expect.stringContaining('0002-refine-adr-index.md'));
  } finally {
    await app.close();
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

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
      'architecture',
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

test('Dock opens Research View and inserts a selected experimental link card', async () => {
  const app = await launchDock(['--dock-e2e-link']);

  try {
    const page = await app.firstWindow();
    const editor = page.getByRole('textbox', { name: 'Markdown 편집기' });
    await expect(editor).toHaveValue('# Start');
    await editor.evaluate((element) => {
      const textarea = element as HTMLTextAreaElement;
      textarea.focus();
      textarea.setSelectionRange(2, 2);
      textarea.dispatchEvent(new Event('select', { bubbles: true }));
    });

    await page.getByRole('button', { name: '명령 팔레트 열기' }).click();
    await page.getByRole('button', { name: /\/link/ }).click();
    await page.getByRole('textbox', { name: '링크 검색어' }).fill('electron');
    await page.getByRole('button', { name: 'Research View 열기' }).click();
    await expect(
      page.getByRole('tab', { name: 'Google Search' }),
    ).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: /^Electron Security/ }).click();

    await expect(editor).toHaveValue(
      '# [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)Start',
    );
  } finally {
    await app.close();
  }
});

test('Dock keeps an actual Research View isolated and blocks privileged actions', async () => {
  const app = await launchDock(['--dock-e2e-research-security']);

  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: '명령 팔레트 열기' }).click();
    await page.getByRole('button', { name: /\/link/ }).click();
    await page.getByRole('textbox', { name: '링크 검색어' }).fill('electron');
    await page.getByRole('button', { name: 'Research View 열기' }).click();
    await expect(
      page.getByRole('button', {
        name: /^Research security fixture https:/,
      }),
    ).toBeVisible();
    await page.getByRole('button', { name: '명령 팔레트 열기' }).click();
    await expect(
      page.getByRole('dialog', { name: '명령 팔레트' }),
    ).toBeVisible();
    await page.getByRole('button', { name: /\/image/ }).click();
    await expect(
      page.getByRole('textbox', { name: '이미지 검색어' }),
    ).toBeVisible();
    await page.getByRole('button', { name: '취소' }).click();
    await app.evaluate(async ({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      const researchView = mainWindow?.contentView.children.find((child) => {
        const candidate = child as unknown as {
          webContents?: { getURL: () => string };
        };
        return candidate.webContents
          ?.getURL()
          .startsWith('https://www.google.com/search');
      }) as unknown as
        | {
            webContents: {
              executeJavaScript: (
                code: string,
                userGesture?: boolean,
              ) => Promise<unknown>;
            };
          }
        | undefined;
      if (!researchView) throw new Error('Research View was not found.');
      await researchView.webContents.executeJavaScript(
        "window.location.assign('https://www.google.com/search?q=second')",
        true,
      );
    });
    await expect(
      page.getByRole('button', { name: /^Second search result https:/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: /^Research security fixture https:/,
      }),
    ).not.toBeVisible();
    const editorBounds = await page
      .getByRole('textbox', { name: 'Markdown 편집기' })
      .boundingBox();
    const researchBounds = await app.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      const researchView = mainWindow?.contentView.children.find((child) => {
        const candidate = child as unknown as {
          webContents?: { getURL: () => string };
        };
        return candidate.webContents
          ?.getURL()
          .startsWith('https://www.google.com/search');
      }) as unknown as
        | {
            getBounds: () => {
              x: number;
              y: number;
              width: number;
              height: number;
            };
          }
        | undefined;
      return researchView?.getBounds();
    });
    expect(editorBounds).not.toBeNull();
    expect(researchBounds).toBeDefined();
    if (!editorBounds || !researchBounds) {
      throw new Error('Research View and editor bounds are required.');
    }
    expect(researchBounds.y + researchBounds.height).toBeLessThanOrEqual(
      editorBounds.y,
    );
    const windowCountBeforePrivilegedActions = (await app.windows()).length;

    const boundary = await app.evaluate(async ({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      const researchView = mainWindow?.contentView.children.find((child) => {
        const candidate = child as unknown as {
          webContents?: { getURL: () => string };
        };
        return candidate.webContents
          ?.getURL()
          .startsWith('https://www.google.com/search');
      }) as unknown as
        | {
            webContents: {
              getURL: () => string;
              executeJavaScript: (
                code: string,
                userGesture?: boolean,
              ) => Promise<unknown>;
              downloadURL: (url: string) => void;
              session: {
                on: (
                  channel: string,
                  listener: (...args: unknown[]) => void,
                ) => void;
                removeListener: (
                  channel: string,
                  listener: (...args: unknown[]) => void,
                ) => void;
              };
            };
          }
        | undefined;
      if (!researchView) return { found: false };

      const { webContents } = researchView;
      const initialUrl = webContents.getURL();
      const remoteCapabilities = await webContents.executeJavaScript(
        `({
          dock: typeof window.dock,
          nodeProcess: typeof window.process,
          require: typeof window.require,
        })`,
        true,
      );
      const popupDenied = await webContents.executeJavaScript(
        `window.open('https://popup.e2e.test/') === null`,
        true,
      );
      const popupTabOpened = await new Promise<boolean>((resolve) => {
        const deadline = Date.now() + 1_000;
        const checkPopupTab = () => {
          const popupTab = mainWindow?.contentView.children.find((child) => {
            const candidate = child as unknown as {
              webContents?: { getURL: () => string };
            };
            return (
              candidate.webContents?.getURL() === 'https://popup.e2e.test/'
            );
          });
          if (popupTab || Date.now() >= deadline) {
            resolve(Boolean(popupTab));
            return;
          }
          setTimeout(checkPopupTab, 50);
        };
        checkPopupTab();
      });
      const permissionDenied = await webContents.executeJavaScript(
        `new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(false),
            (error) => resolve(error.code === error.PERMISSION_DENIED),
            { timeout: 500 },
          );
        })`,
        true,
      );
      await webContents.executeJavaScript(
        `try { window.location.assign('file:///research-security-e2e.txt'); } catch {}`,
        true,
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      const navigationBlocked = webContents.getURL() === initialUrl;
      const downloadPrevented = await new Promise((resolve) => {
        const onDownload = (event: { defaultPrevented: boolean }) => {
          webContents.session.removeListener('will-download', onDownload);
          resolve(event.defaultPrevented);
        };
        webContents.session.on('will-download', onDownload);
        webContents.downloadURL('data:text/plain,research-security-e2e');
        setTimeout(() => {
          webContents.session.removeListener('will-download', onDownload);
          resolve(false);
        }, 1_000);
      });

      return {
        found: true,
        remoteCapabilities,
        popupDenied,
        popupTabOpened,
        permissionDenied,
        navigationBlocked,
        downloadPrevented,
      };
    });

    expect(boundary).toMatchObject({
      found: true,
      remoteCapabilities: {
        dock: 'undefined',
        nodeProcess: 'undefined',
        require: 'undefined',
      },
      popupDenied: true,
      popupTabOpened: true,
      permissionDenied: true,
      navigationBlocked: true,
      downloadPrevented: true,
    });
    expect(await app.windows()).toHaveLength(
      windowCountBeforePrivilegedActions + 1,
    );
  } finally {
    await app.close();
  }
});

test('Dock inserts the current allowed Research View page as a fallback link', async () => {
  const app = await launchDock(['--dock-e2e-research-security']);

  try {
    const page = await app.firstWindow();
    const editor = page.getByRole('textbox', { name: 'Markdown 편집기' });
    await editor.evaluate((element) => {
      const textarea = element as HTMLTextAreaElement;
      textarea.focus();
      textarea.setSelectionRange(2, 2);
      textarea.dispatchEvent(new Event('select', { bubbles: true }));
    });
    await page.getByRole('button', { name: '명령 팔레트 열기' }).click();
    await page.getByRole('button', { name: /\/link/ }).click();
    await page.getByRole('textbox', { name: '링크 검색어' }).fill('electron');
    await page.getByRole('button', { name: 'Research View 열기' }).click();
    await expect(
      page.getByRole('button', {
        name: /^Research security fixture https:/,
      }),
    ).toBeVisible();

    await app.evaluate(async ({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      const researchView = mainWindow?.contentView.children.find((child) => {
        const candidate = child as unknown as {
          webContents?: { getURL: () => string };
        };
        return candidate.webContents
          ?.getURL()
          .startsWith('https://www.google.com/search');
      }) as unknown as
        | {
            webContents: {
              executeJavaScript: (
                code: string,
                userGesture?: boolean,
              ) => Promise<unknown>;
            };
          }
        | undefined;
      if (!researchView) throw new Error('Research View was not found.');
      await researchView.webContents.executeJavaScript(
        "window.location.assign('https://example.com/research-fallback')",
        true,
      );
    });

    await expect
      .poll(
        () =>
          app.evaluate(({ BrowserWindow }) => {
            const mainWindow = BrowserWindow.getAllWindows()[0];
            const researchView = mainWindow?.contentView.children.find(
              (child) => {
                const candidate = child as unknown as {
                  webContents?: {
                    getURL: () => string;
                    getTitle: () => string;
                  };
                };
                return candidate.webContents
                  ?.getURL()
                  .startsWith('https://example.com/research-fallback');
              },
            ) as unknown as
              | {
                  webContents: {
                    getURL: () => string;
                    getTitle: () => string;
                  };
                }
              | undefined;
            return researchView
              ? {
                  url: researchView.webContents.getURL(),
                  title: researchView.webContents.getTitle(),
                }
              : undefined;
          }),
        { timeout: 10_000 },
      )
      .toEqual({
        url: 'https://example.com/research-fallback',
        title: 'Research fallback page',
      });

    await page.getByRole('button', { name: '현재 페이지 링크 삽입' }).click();
    await expect(editor).toHaveValue(
      '# [Research fallback page](https://example.com/research-fallback)Start',
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
    await page.route('https://images.example.test/*.png', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          'base64',
        ),
      }),
    );
    const editor = page.getByRole('textbox', { name: 'Markdown 편집기' });
    await expect(editor).toHaveValue('# Start');

    await page.getByRole('button', { name: '명령 팔레트 열기' }).click();
    await page.getByRole('button', { name: /\/image/ }).click();
    await page.getByRole('textbox', { name: '이미지 검색어' }).fill('electron');
    await page.getByRole('button', { name: '검색' }).click();
    await expect(
      page.getByRole('img', { name: 'Electron process model 썸네일' }),
    ).toBeVisible();
    await page.getByRole('button', { name: /Electron process model/ }).click();
    await page.getByRole('button', { name: '다운로드 및 삽입' }).click();

    const expectedContent =
      '# Start![Electron process model](./assets/electron-process-model.png)';
    await expect
      .poll(
        () =>
          page.evaluate((expected) => {
            const currentEditor = document.querySelector<HTMLTextAreaElement>(
              '[aria-label="Markdown 편집기"]',
            );
            if (currentEditor?.value === expected) return 'complete';
            const dialog = document.querySelector('[role="dialog"]');
            const error = dialog
              ?.querySelector('[role="alert"]')
              ?.textContent?.trim();
            const errorCode = dialog
              ?.querySelector('[role="alert"]')
              ?.getAttribute('data-image-error-code');
            if (error) return `error: ${errorCode ?? 'unknown'}: ${error}`;
            const status = dialog
              ?.querySelector('[role="status"]')
              ?.textContent?.trim();
            return `pending: ${status ?? 'none'}`;
          }, expectedContent),
        { timeout: 15_000 },
      )
      .toBe('complete');
    await expect(editor).toHaveValue(expectedContent);
    await expect(
      page.locator('.preview-content img[alt="Electron process model"]'),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});
