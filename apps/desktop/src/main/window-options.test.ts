import { describe, expect, it } from 'vitest';
import { createMainWindowOptions } from './window-options';

describe('createMainWindowOptions', () => {
  it('explicitly enables the required Electron security options', () => {
    const options = createMainWindowOptions('C:/Dock/preload.js');

    expect(options.webPreferences).toMatchObject({
      preload: 'C:/Dock/preload.js',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    });
    expect(options).toMatchObject({ minWidth: 736, minHeight: 545 });
  });
});
