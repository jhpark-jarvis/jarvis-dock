import type { BrowserWindowConstructorOptions } from 'electron';

export const createMainWindowOptions = (
  preloadPath: string,
): BrowserWindowConstructorOptions => ({
  width: 800,
  height: 600,
  // Electron applies these values to the outer window frame. Keep the
  // content viewport at roughly 720x480 on Windows after frame insets.
  minWidth: 736,
  minHeight: 545,
  webPreferences: {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
  },
});
