import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../shared/ipc';
import { registerLinkBrowserSearchHandlers } from './link-browser-search-handlers';

type InvokeHandler = (event: IpcMainInvokeEvent, request: unknown) => unknown;

const createHarness = (
  openLinkSearch: (query: string) => Promise<void> = async () => undefined,
) => {
  const handlers = new Map<string, InvokeHandler>();
  const handle = vi.fn((channel: string, handler: InvokeHandler) =>
    handlers.set(channel, handler),
  );
  registerLinkBrowserSearchHandlers({
    ipcMain: { handle },
    isTrustedSender: (url) => url === 'http://localhost:5173/',
    openLinkSearch,
  });
  const invoke = (request: unknown, trusted = true) =>
    handlers.get(IPC.OPEN_LINK_SEARCH)?.(
      {
        senderFrame: {
          url: trusted ? 'http://localhost:5173/' : 'https://evil.example/',
        },
      } as IpcMainInvokeEvent,
      request,
    );
  return { handle, invoke };
};

describe('registerLinkBrowserSearchHandlers', () => {
  it('validates the sender and bounded query before opening the browser', async () => {
    const openLinkSearch = vi.fn(async () => undefined);
    const { handle, invoke } = createHarness(openLinkSearch);

    expect(handle).toHaveBeenCalledWith(
      IPC.OPEN_LINK_SEARCH,
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
    expect(openLinkSearch).not.toHaveBeenCalled();
  });

  it('returns only a safe success result after opening the browser', async () => {
    const openLinkSearch = vi.fn(async (query: string) => {
      expect(query).toBe('electron security');
    });
    const { invoke } = createHarness(openLinkSearch);

    await expect(invoke({ query: 'electron security' })).resolves.toEqual({
      ok: true,
      value: { opened: true },
    });
  });

  it('maps browser launch failures to a safe error contract', async () => {
    const { invoke } = createHarness(async () => {
      throw new Error('shell failure');
    });

    await expect(invoke({ query: 'electron' })).resolves.toEqual({
      ok: false,
      error: {
        code: 'EXTERNAL_OPEN_FAILED',
        message: 'The browser search could not be opened.',
      },
    });
  });
});
