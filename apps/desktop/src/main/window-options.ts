import type { BrowserWindowConstructorOptions } from 'electron';

export const createMainWindowOptions = (
  preloadPath: string,
): BrowserWindowConstructorOptions => ({
  width: 1200,
  height: 800,
  // Electron applies these values to the outer window frame. Keep the
  // content viewport at roughly 960x600 on Windows after frame insets.
  minWidth: 976,
  minHeight: 665,
  webPreferences: {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
  },
});
