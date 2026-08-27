import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  session,
  shell,
  type WebContents,
} from 'electron';
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import started from 'electron-squirrel-startup';
import {
  isAllowedRendererNavigation,
  isTrustedRendererUrl,
  withContentSecurityPolicy,
} from './security';
import { registerSystemHandlers } from './system-handlers';
import {
  registerResearchHandlers,
  type ResearchController,
} from './research-handlers';
import { ResearchViewManager } from './research-view';
import { createMainWindowOptions } from './window-options';
import { registerImageSearchHandlers } from './image-search-handlers';
import { registerImageDownloadHandlers } from './image-download-handlers';
import { registerImageAssetHandlers } from './image-asset-handlers';
import { WIKIMEDIA_IMAGE_HOSTS } from './image-search-service';
import { registerWorkspaceHandlers } from './workspace-handlers';
import { createWorkspaceStore, type WorkspaceStore } from './workspace-service';
import type { ImageDownloadResult } from '../shared/ipc';

const E2E_WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const E2E_DOCUMENT_WORKSPACE_ROOT = 'DOCK_E2E_DOCUMENT_WORKSPACE_ROOT';
const E2E_RESEARCH_SECURITY_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Research security fixture</title></head>
  <body>
    <a href="https://www.electronjs.org/docs/latest/tutorial/security">
      <h3>Research security fixture</h3>
    </a>
  </body>
</html>`;
const E2E_RESEARCH_SECOND_SEARCH_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Second search fixture</title></head>
  <body>
    <a href="https://www.electronjs.org/docs/latest/tutorial/process-model">
      <h3>Second search result</h3>
    </a>
  </body>
</html>`;
const E2E_RESEARCH_FALLBACK_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Research fallback page</title></head>
  <body><h1>Research fallback page</h1></body>
</html>`;
const E2E_RESEARCH_POPUP_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Research popup tab</title></head>
  <body><h1>Research popup tab</h1></body>
</html>`;

let cleanupE2eWorkspace: (() => void) | undefined;
let researchController: ResearchController | undefined;
let e2eDocumentWorkspaceRoot: string | undefined;

const isE2eDocumentDialogMode = (): boolean =>
  process.argv.includes('--dock-e2e-document') ||
  process.argv.includes('--dock-e2e-document-write-failure') ||
  process.argv.includes('--dock-e2e-document-cancel');

const isE2eDocumentWorkspaceMode = (): boolean =>
  process.argv.includes('--dock-e2e-document') ||
  process.argv.includes('--dock-e2e-document-write-failure');

const setupE2eWorkspace = (store: WorkspaceStore): (() => void) | undefined => {
  const e2eMode = process.argv.includes('--dock-e2e-image')
    ? 'image'
    : process.argv.includes('--dock-e2e-link')
      ? 'link'
      : process.argv.includes('--dock-e2e-research-security')
        ? 'research-security'
        : isE2eDocumentWorkspaceMode()
          ? 'document'
          : undefined;
  if (!e2eMode) return undefined;
  const configuredDocumentRoot =
    e2eMode === 'document'
      ? process.env[E2E_DOCUMENT_WORKSPACE_ROOT]
      : undefined;
  const rootPath = configuredDocumentRoot
    ? path.resolve(configuredDocumentRoot)
    : mkdtempSync(path.join(os.tmpdir(), `dock-e2e-${e2eMode}-`));
  const ownsRoot = !configuredDocumentRoot;
  if (ownsRoot)
    writeFileSync(path.join(rootPath, 'guide.md'), '# Start', 'utf8');
  const root = realpathSync(rootPath);
  if (e2eMode === 'document') e2eDocumentWorkspaceRoot = root;
  store.set(E2E_WORKSPACE_ID, root);
  return () => {
    store.delete(E2E_WORKSPACE_ID);
    if (e2eDocumentWorkspaceRoot === root) {
      e2eDocumentWorkspaceRoot = undefined;
    }
    if (ownsRoot) rmSync(root, { recursive: true, force: true });
  };
};

const createE2eDocumentDialog = () => ({
  showOpenDialog: async () => ({
    canceled:
      process.argv.includes('--dock-e2e-document-cancel') ||
      !e2eDocumentWorkspaceRoot,
    filePaths:
      process.argv.includes('--dock-e2e-document-cancel') ||
      !e2eDocumentWorkspaceRoot
        ? []
        : [e2eDocumentWorkspaceRoot],
  }),
});

const failE2eDocumentWrite = async (): Promise<never> => {
  throw Object.assign(new Error('Document write fixture failure.'), {
    code: 'EACCES',
  });
};

const E2E_IMAGE_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const downloadE2eImage = ({
  root,
}: {
  root: string;
}): Promise<ImageDownloadResult> => {
  const assetPath = path.join(root, 'assets', 'electron-process-model.png');
  mkdirSync(path.dirname(assetPath), { recursive: true });
  writeFileSync(assetPath, E2E_IMAGE_BYTES);
  return Promise.resolve({
    assetPath: 'assets/electron-process-model.png',
    bytesWritten: E2E_IMAGE_BYTES.byteLength,
    mimeType: 'image/png',
  });
};

const registerE2eResearchSecurityFixture = (): void => {
  if (!process.argv.includes('--dock-e2e-research-security')) return;
  session
    .fromPartition('persist:dock-research')
    .protocol.handle('https', (request) => {
      const url = new URL(request.url);
      if (
        url.origin === 'https://www.google.com' &&
        url.pathname === '/search'
      ) {
        const html =
          url.searchParams.get('q') === 'second'
            ? E2E_RESEARCH_SECOND_SEARCH_HTML
            : E2E_RESEARCH_SECURITY_HTML;
        return new Response(html, {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      if (
        url.origin === 'https://example.com' &&
        url.pathname === '/research-fallback'
      ) {
        return new Response(E2E_RESEARCH_FALLBACK_HTML, {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      if (url.origin === 'https://popup.e2e.test' && url.pathname === '/') {
        return new Response(E2E_RESEARCH_POPUP_HTML, {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      return new Response('Research security fixture blocks test network.', {
        status: 404,
      });
    });
};

const createE2eResearchController = (): ResearchController => {
  let open = false;
  const tab = {
    id: 'research-e2e',
    title: 'Google Search',
    url: 'https://www.google.com/search?q=electron',
    loading: false,
  };
  return {
    open: async () => {
      open = true;
      return [
        {
          title: 'Electron Security',
          url: 'https://www.electronjs.org/docs/latest/tutorial/security',
        },
        {
          title: 'Electron Process Model',
          url: 'https://www.electronjs.org/docs/latest/tutorial/process-model',
        },
      ];
    },
    close: () => {
      open = false;
    },
    currentLink: () =>
      open
        ? {
            title: 'Electron Security',
            url: 'https://www.electronjs.org/docs/latest/tutorial/security',
          }
        : undefined,
    info: () => ({
      activeTabId: open ? tab.id : null,
      tabs: open ? [tab] : [],
      results: open
        ? [
            {
              title: 'Electron Security',
              url: 'https://www.electronjs.org/docs/latest/tutorial/security',
            },
            {
              title: 'Electron Process Model',
              url: 'https://www.electronjs.org/docs/latest/tutorial/process-model',
            },
          ]
        : [],
    }),
    selectTab: (tabId) => open && tabId === tab.id,
    reload: () => open,
    stop: () => open,
    closeTab: (tabId) => {
      if (!open || tabId !== tab.id) return false;
      open = false;
      return true;
    },
    setVisible: () => open,
  };
};

const getRendererUrl = (): string => {
  const rendererUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).toString()
    : pathToFileURL(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      ).toString();

  const e2eMode = process.argv.includes('--dock-e2e-link')
    ? 'link'
    : process.argv.includes('--dock-e2e-image')
      ? 'image'
      : process.argv.includes('--dock-e2e-research-security')
        ? 'research-security'
        : undefined;
  if (e2eMode) {
    const url = new URL(rendererUrl);
    url.searchParams.set('e2e', e2eMode);
    return url.toString();
  }

  return rendererUrl;
};

const configureRendererSecurity = (
  webContents: WebContents,
  rendererUrl: string,
  isDevelopment: boolean,
): void => {
  webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAllowedRendererNavigation(targetUrl, rendererUrl)) {
      event.preventDefault();
    }
  });

  webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (!isDevelopment) {
    webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: withContentSecurityPolicy(details.responseHeaders),
      });
    });
  }
};

const createWindow = () => {
  const mainWindow = new BrowserWindow(
    createMainWindowOptions(path.join(__dirname, 'preload.js')),
  );
  const rendererUrl = getRendererUrl();

  configureRendererSecurity(
    mainWindow.webContents,
    rendererUrl,
    Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL),
  );

  researchController = process.argv.includes('--dock-e2e-link')
    ? createE2eResearchController()
    : new ResearchViewManager(mainWindow);
  mainWindow.on('closed', () => {
    researchController = undefined;
  });

  mainWindow.loadURL(rendererUrl);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // Keep DevTools in a separate window so its docked viewport does not
    // change the coordinate space used by the native Research View.
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
};

const registerIpcHandlers = () => {
  const workspaceStore = createWorkspaceStore();
  cleanupE2eWorkspace = setupE2eWorkspace(workspaceStore);
  registerSystemHandlers({
    ipcMain,
    getVersion: () => app.getVersion(),
    isTrustedSender: (senderUrl) =>
      isTrustedRendererUrl(senderUrl, getRendererUrl()),
  });
  registerWorkspaceHandlers({
    ipcMain,
    dialog: isE2eDocumentDialogMode() ? createE2eDocumentDialog() : dialog,
    documentWriter: process.argv.includes('--dock-e2e-document-write-failure')
      ? failE2eDocumentWrite
      : undefined,
    store: workspaceStore,
    isTrustedSender: (senderUrl) =>
      isTrustedRendererUrl(senderUrl, getRendererUrl()),
    openPath: (folderPath) => shell.openPath(folderPath),
  });
  registerResearchHandlers({
    ipcMain,
    getResearchController: () => researchController,
    isTrustedSender: (senderUrl) =>
      isTrustedRendererUrl(senderUrl, getRendererUrl()),
  });
  registerImageSearchHandlers({
    ipcMain,
    isTrustedSender: (senderUrl) =>
      isTrustedRendererUrl(senderUrl, getRendererUrl()),
  });
  registerImageDownloadHandlers({
    ipcMain,
    store: workspaceStore,
    downloadImage: cleanupE2eWorkspace ? downloadE2eImage : undefined,
    allowedHosts: new Set(['images.example.test', ...WIKIMEDIA_IMAGE_HOSTS]),
    isTrustedSender: (senderUrl) =>
      isTrustedRendererUrl(senderUrl, getRendererUrl()),
  });
  registerImageAssetHandlers({
    ipcMain,
    store: workspaceStore,
    isTrustedSender: (senderUrl) =>
      isTrustedRendererUrl(senderUrl, getRendererUrl()),
  });
};

if (started) {
  app.quit();
} else {
  app.whenReady().then(() => {
    registerE2eResearchSecurityFixture();
    registerIpcHandlers();
    createWindow();
  });
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  cleanupE2eWorkspace?.();
  cleanupE2eWorkspace = undefined;
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
