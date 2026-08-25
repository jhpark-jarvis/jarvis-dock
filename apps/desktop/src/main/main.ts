import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  session,
  type WebContents,
} from 'electron';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
import { WIKIMEDIA_IMAGE_HOSTS } from './image-search-service';
import {
  downloadImageToWorkspace,
  type ImageDownloadServiceDependencies,
  type DownloadImageRequest,
} from './image-download-service';
import { registerWorkspaceHandlers } from './workspace-handlers';
import { createWorkspaceStore, type WorkspaceStore } from './workspace-service';
import type { ImageDownloadResult } from '../shared/ipc';

const E2E_WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const E2E_DOCUMENT_WORKSPACE_ROOT = 'DOCK_E2E_DOCUMENT_WORKSPACE_ROOT';
const E2E_PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const E2E_RESEARCH_SECURITY_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Research security fixture</title></head>
  <body>
    <a href="https://www.electronjs.org/docs/latest/tutorial/security">
      <h3>Research security fixture</h3>
    </a>
  </body>
</html>`;

let cleanupE2eWorkspace: (() => void) | undefined;
let researchController: ResearchController | undefined;
let e2eDocumentWorkspaceRoot: string | undefined;

const setupE2eWorkspace = (store: WorkspaceStore): (() => void) | undefined => {
  const e2eMode = process.argv.includes('--dock-e2e-image')
    ? 'image'
    : process.argv.includes('--dock-e2e-link')
      ? 'link'
      : process.argv.includes('--dock-e2e-research-security')
        ? 'research-security'
        : process.argv.includes('--dock-e2e-document')
          ? 'document'
          : undefined;
  if (!e2eMode) return undefined;
  const configuredDocumentRoot =
    e2eMode === 'document'
      ? process.env[E2E_DOCUMENT_WORKSPACE_ROOT]
      : undefined;
  const root = configuredDocumentRoot
    ? path.resolve(configuredDocumentRoot)
    : mkdtempSync(path.join(os.tmpdir(), `dock-e2e-${e2eMode}-`));
  const ownsRoot = !configuredDocumentRoot;
  if (ownsRoot) writeFileSync(path.join(root, 'guide.md'), '# Start', 'utf8');
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
    canceled: !e2eDocumentWorkspaceRoot,
    filePaths: e2eDocumentWorkspaceRoot ? [e2eDocumentWorkspaceRoot] : [],
  }),
});

const downloadE2eImage = (
  request: DownloadImageRequest,
  dependencies: ImageDownloadServiceDependencies,
): Promise<ImageDownloadResult> =>
  downloadImageToWorkspace(request, {
    ...dependencies,
    fetchImpl: async () =>
      new Response(E2E_PNG, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
  });

const registerE2eResearchSecurityFixture = (): void => {
  if (!process.argv.includes('--dock-e2e-research-security')) return;
  session.fromPartition('dock-research').protocol.handle('https', (request) => {
    const url = new URL(request.url);
    if (url.origin === 'https://www.google.com' && url.pathname === '/search') {
      return new Response(E2E_RESEARCH_SECURITY_HTML, {
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
    mainWindow.webContents.openDevTools();
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
    dialog: process.argv.includes('--dock-e2e-document')
      ? createE2eDocumentDialog()
      : dialog,
    store: workspaceStore,
    isTrustedSender: (senderUrl) =>
      isTrustedRendererUrl(senderUrl, getRendererUrl()),
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
