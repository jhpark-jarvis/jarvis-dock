import type { BrowserWindowConstructorOptions } from 'electron';

export const createMainWindowOptions = (
  preloadPath: string,
): BrowserWindowConstructorOptions => ({
  width: 800,
  height: 600,
  minWidth: 720,
  minHeight: 480,
  webPreferences: {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
  },
});
