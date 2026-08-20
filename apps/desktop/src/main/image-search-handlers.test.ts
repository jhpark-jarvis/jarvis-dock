import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { IPC, type ImageSearchResult } from '../shared/ipc';
import { ImageSearchServiceError } from './image-search-service';
import { registerImageSearchHandlers } from './image-search-handlers';

type InvokeHandler = (event: IpcMainInvokeEvent, request: unknown) => unknown;

const createHarness = (
  searchImages: (
    query: string,
  ) => Promise<ImageSearchResult[]> = async () => [],
) => {
  const handlers = new Map<string, InvokeHandler>();
  const handle = vi.fn((channel: string, handler: InvokeHandler) =>
    handlers.set(channel, handler),
  );
  registerImageSearchHandlers({
    ipcMain: { handle },
    isTrustedSender: (url) => url === 'http://localhost:5173/',
    searchImages,
  });
  const invoke = (request: unknown, trusted = true) =>
    handlers.get(IPC.SEARCH_IMAGES)?.(
      {
        senderFrame: {
          url: trusted ? 'http://localhost:5173/' : 'https://evil.example/',
        },
      } as IpcMainInvokeEvent,
      request,
    );
  return { handle, invoke };
};

const result: ImageSearchResult = {
  id: '42',
  title: 'Electron security.png',
  sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Electron',
  thumbnailUrl: 'https://upload.wikimedia.org/thumb.png',
  downloadUrl: 'https://upload.wikimedia.org/image.png',
  source: 'Wikimedia Commons',
  license: 'CC BY-SA 4.0',
};

describe('registerImageSearchHandlers', () => {
  it('validates the sender and query before calling the provider', async () => {
    const searchImages = vi.fn(async () => [result]);
    const { handle, invoke } = createHarness(searchImages);

    expect(handle).toHaveBeenCalledWith(
      IPC.SEARCH_IMAGES,
      expect.any(Function),
    );
    await expect(invoke({ query: 'electron' }, false)).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED_SENDER' },
    });
    await expect(invoke({ query: '' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST' },
    });
    expect(searchImages).not.toHaveBeenCalled();
  });

  it('returns provider results and maps provider failures safely', async () => {
    const { invoke } = createHarness(async (query) => {
      expect(query).toBe('electron');
      return [result];
    });
    await expect(invoke({ query: 'electron' })).resolves.toEqual({
      ok: true,
      value: { results: [result] },
    });

    const failed = createHarness(async () => {
      throw new ImageSearchServiceError(
        'IMAGE_SEARCH_UNAVAILABLE',
        'The image search provider is unavailable.',
      );
    });
    await expect(failed.invoke({ query: 'electron' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'IMAGE_SEARCH_UNAVAILABLE' },
    });
  });
});
