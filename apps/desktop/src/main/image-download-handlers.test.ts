import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageSearchResult } from '../shared/ipc';
import { IPC } from '../shared/ipc';
import { registerImageDownloadHandlers } from './image-download-handlers';

type InvokeHandler = (event: IpcMainInvokeEvent, request: unknown) => unknown;

const image: ImageSearchResult = {
  id: 'image-1',
  title: 'Electron Process Model',
  sourcePageUrl: 'https://example.com/source',
  thumbnailUrl: 'https://images.example.test/thumb.png',
  downloadUrl: 'https://images.example.test/process.png',
  source: 'Example',
  license: 'Mock',
};

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => fs.rm(root, { recursive: true })),
  );
});

const createHarness = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-dock-image-'));
  roots.push(root);
  await fs.writeFile(path.join(root, 'guide.md'), '# Guide');
  const realRoot = await fs.realpath(root);
  const store = new Map([['11111111-1111-4111-8111-111111111111', realRoot]]);
  const handlers = new Map<string, InvokeHandler>();
  const handle = vi.fn((channel: string, handler: InvokeHandler) =>
    handlers.set(channel, handler),
  );
  const downloadImage = vi.fn(async (request: { root: string }) => {
    expect(request.root).toBe(realRoot);
    return {
      assetPath: 'assets/electron-process-model.png',
      bytesWritten: 8,
      mimeType: 'image/png' as const,
    };
  });
  registerImageDownloadHandlers({
    ipcMain: { handle },
    isTrustedSender: (url) => url === 'http://localhost:5173/',
    allowedHosts: new Set(['images.example.test']),
    store,
    downloadImage,
  });
  const invoke = (request: unknown, trusted = true) =>
    handlers.get(IPC.IMAGE_DOWNLOAD)?.(
      {
        senderFrame: {
          url: trusted ? 'http://localhost:5173/' : 'https://evil.example/',
        },
      } as IpcMainInvokeEvent,
      request,
    );
  return { downloadImage, handle, invoke };
};

describe('registerImageDownloadHandlers', () => {
  it('validates sender and request before downloading', async () => {
    const { downloadImage, handle, invoke } = await createHarness();

    expect(handle).toHaveBeenCalledWith(
      IPC.IMAGE_DOWNLOAD,
      expect.any(Function),
    );
    await expect(invoke({ workspaceId: 'bad' }, false)).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED_SENDER' },
    });
    await expect(invoke({ workspaceId: 'bad' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST' },
    });
    expect(downloadImage).not.toHaveBeenCalled();
  });

  it('resolves the document workspace and returns the saved asset contract', async () => {
    const { downloadImage, invoke } = await createHarness();

    await expect(
      invoke({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        relativePath: 'guide.md',
        image,
      }),
    ).resolves.toEqual({
      ok: true,
      value: {
        assetPath: 'assets/electron-process-model.png',
        bytesWritten: 8,
        mimeType: 'image/png',
      },
    });
    expect(downloadImage).toHaveBeenCalledWith(
      { root: expect.any(String), image },
      { allowedHosts: new Set(['images.example.test']) },
    );
  });

  it('maps provider failures without returning internal details', async () => {
    const { invoke } = await createHarness();
    const result = await invoke({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      relativePath: 'missing.md',
      image,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
  });
});
