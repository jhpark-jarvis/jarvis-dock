import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../shared/ipc';
import { LinkSearchServiceError } from './link-search-service';
import { registerLinkSearchHandlers } from './link-search-handlers';

type InvokeHandler = (event: IpcMainInvokeEvent, request: unknown) => unknown;
type SearchResult = { title: string; url: string; source: string };

const createHarness = (
  searchLinks: (
    query: string,
    apiKey: string,
  ) => Promise<SearchResult[]> = async () => [],
) => {
  const handlers = new Map<string, InvokeHandler>();
  const handle = vi.fn((channel: string, handler: InvokeHandler) =>
    handlers.set(channel, handler),
  );
  registerLinkSearchHandlers({
    ipcMain: { handle },
    isTrustedSender: (url) => url === 'http://localhost:5173/',
    searchLinks,
  });
  const invoke = (request: unknown, trusted = true) =>
    handlers.get(IPC.SEARCH_LINKS)?.(
      {
        senderFrame: {
          url: trusted ? 'http://localhost:5173/' : 'https://evil.example/',
        },
      } as IpcMainInvokeEvent,
      request,
    );
  return { handle, invoke };
};

describe('registerLinkSearchHandlers', () => {
  it('validates the sender and request before calling the provider', async () => {
    const searchLinks = vi.fn(async () => []);
    const { handle, invoke } = createHarness(searchLinks);

    expect(handle).toHaveBeenCalledWith(IPC.SEARCH_LINKS, expect.any(Function));
    await expect(
      invoke({ query: 'electron', apiKey: 'key' }, false),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'UNAUTHORIZED_SENDER',
        message: 'The Dock request is not authorized.',
      },
    });
    await expect(invoke({ query: '', apiKey: 'key' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST' },
    });
    expect(searchLinks).not.toHaveBeenCalled();
  });

  it('returns provider results without exposing the API key', async () => {
    const searchLinks = vi.fn(async (query: string, apiKey: string) => {
      expect(query).toBe('electron');
      expect(apiKey).toBe('key');
      return [
        {
          title: 'Electron',
          url: 'https://www.electronjs.org',
          source: 'Electron documentation',
        },
      ];
    });
    const { invoke } = createHarness(searchLinks);

    await expect(invoke({ query: 'electron', apiKey: 'key' })).resolves.toEqual(
      {
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
      },
    );
  });

  it('maps provider errors to safe error contracts', async () => {
    const { invoke } = createHarness(async () => {
      throw new LinkSearchServiceError(
        'SEARCH_RATE_LIMITED',
        'The search provider rate limit was reached.',
      );
    });

    await expect(invoke({ query: 'electron', apiKey: 'key' })).resolves.toEqual(
      {
        ok: false,
        error: {
          code: 'SEARCH_RATE_LIMITED',
          message: 'The search provider rate limit was reached.',
        },
      },
    );
  });
});
