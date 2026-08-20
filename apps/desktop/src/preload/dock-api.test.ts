import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../shared/ipc';
import { createDockApi } from './dock-api';

describe('createDockApi', () => {
  it('invokes only the fixed health channel with an empty request', async () => {
    const invoke = vi.fn().mockResolvedValue({
      ok: true,
      value: { status: 'ok' },
    });
    const dock = createDockApi({ invoke });

    await expect(dock.system.health()).resolves.toEqual({
      ok: true,
      value: { status: 'ok' },
    });
    expect(invoke).toHaveBeenCalledWith(IPC.SYSTEM_HEALTH, {});
  });

  it('does not pass an invalid Main response through to the Renderer', async () => {
    const invoke = vi.fn().mockResolvedValue({ leaked: 'unexpected value' });
    const dock = createDockApi({ invoke });

    await expect(dock.system.version()).resolves.toEqual({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'The Dock system request could not be completed.',
      },
    });
    expect(invoke).toHaveBeenCalledWith(IPC.SYSTEM_VERSION, {});
  });

  it('validates and invokes the fixed link search channel', async () => {
    const invoke = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        results: [
          {
            title: 'Electron',
            url: 'https://www.electronjs.org',
            source: 'Electron documentation',
          },
        ],
      },
    });
    const dock = createDockApi({ invoke });

    await expect(
      dock.search.links({ query: 'electron', apiKey: 'key' }),
    ).resolves.toMatchObject({ ok: true });
    expect(invoke).toHaveBeenCalledWith(IPC.SEARCH_LINKS, {
      query: 'electron',
      apiKey: 'key',
    });
  });

  it('validates and invokes the fixed image download channel', async () => {
    const invoke = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        assetPath: 'assets/electron-process-model.png',
        bytesWritten: 8,
        mimeType: 'image/png',
      },
    });
    const dock = createDockApi({ invoke });
    const request = {
      workspaceId: '11111111-1111-4111-8111-111111111111',
      relativePath: 'guide.md',
      image: {
        id: 'image-1',
        title: 'Electron Process Model',
        sourcePageUrl: 'https://example.com/source',
        thumbnailUrl: 'https://images.example.test/thumb.png',
        downloadUrl: 'https://images.example.test/process.png',
        source: 'Example',
        license: 'Mock',
      },
    };

    await expect(dock.image.download(request)).resolves.toMatchObject({
      ok: true,
    });
    expect(invoke).toHaveBeenCalledWith(IPC.IMAGE_DOWNLOAD, request);
  });
});
