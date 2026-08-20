import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type WebContents,
} from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import started from 'electron-squirrel-startup';
import {
  isAllowedRendererNavigation,
  isTrustedRendererUrl,
  withContentSecurityPolicy,
} from './security';
import { registerSystemHandlers } from './system-handlers';
import { registerLinkSearchHandlers } from './link-search-handlers';
import { registerWorkspaceHandlers } from './workspace-handlers';
import { createMainWindowOptions } from './window-options';

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

  mainWindow.loadURL(rendererUrl);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }
};

const registerIpcHandlers = () => {
  registerSystemHandlers({
    ipcMain,
    getVersion: () => app.getVersion(),
    isTrustedSender: (senderUrl) =>
      isTrustedRendererUrl(senderUrl, getRendererUrl()),
  });
  registerWorkspaceHandlers({
    ipcMain,
    dialog,
    isTrustedSender: (senderUrl) =>
      isTrustedRendererUrl(senderUrl, getRendererUrl()),
  });
  registerLinkSearchHandlers({
    ipcMain,
    isTrustedSender: (senderUrl) =>
      isTrustedRendererUrl(senderUrl, getRendererUrl()),
  });
};

if (started) {
  app.quit();
} else {
  app.whenReady().then(() => {
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

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
