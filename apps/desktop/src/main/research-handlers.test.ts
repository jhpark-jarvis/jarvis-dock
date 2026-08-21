import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../shared/ipc';
import {
  registerResearchHandlers,
  type ResearchController,
} from './research-handlers';

type InvokeHandler = (event: IpcMainInvokeEvent, request: unknown) => unknown;

const createController = (): ResearchController => ({
  open: async () => undefined,
  close: () => undefined,
  currentLink: () => ({
    title: 'Electron Security',
    url: 'https://www.electronjs.org/docs/latest/tutorial/security',
  }),
});

const createHarness = (controller: ResearchController | undefined) => {
  const handlers = new Map<string, InvokeHandler>();
  const handle = vi.fn((channel: string, handler: InvokeHandler) =>
    handlers.set(channel, handler),
  );
  registerResearchHandlers({
    ipcMain: { handle },
    getResearchController: () => controller,
    isTrustedSender: (url) => url === 'http://localhost:5173/',
  });
  const invoke = (channel: string, request: unknown, trusted = true) =>
    handlers.get(channel)?.(
      {
        senderFrame: {
          url: trusted ? 'http://localhost:5173/' : 'https://evil.example/',
        },
      } as IpcMainInvokeEvent,
      request,
    );
  return { handle, invoke };
};

describe('registerResearchHandlers', () => {
  it('validates sender and query before opening the Research View', async () => {
    const controller = createController();
    const open = vi.spyOn(controller, 'open');
    const { handle, invoke } = createHarness(controller);

    expect(handle).toHaveBeenCalledWith(
      IPC.RESEARCH_OPEN,
      expect.any(Function),
    );
    await expect(
      invoke(IPC.RESEARCH_OPEN, { query: 'electron' }, false),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED_SENDER' },
    });
    await expect(
      invoke(IPC.RESEARCH_OPEN, { query: '' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(open).not.toHaveBeenCalled();
  });

  it('opens, returns the current link, and closes through fixed channels', async () => {
    const controller = createController();
    const open = vi.spyOn(controller, 'open');
    const close = vi.spyOn(controller, 'close');
    const { invoke } = createHarness(controller);

    await expect(
      invoke(IPC.RESEARCH_OPEN, { query: 'electron security' }),
    ).resolves.toEqual({ ok: true, value: { opened: true } });
    expect(open).toHaveBeenCalledWith('electron security');
    expect(invoke(IPC.RESEARCH_CURRENT_LINK, {})).toEqual({
      ok: true,
      value: {
        title: 'Electron Security',
        url: 'https://www.electronjs.org/docs/latest/tutorial/security',
      },
    });
    expect(invoke(IPC.RESEARCH_CLOSE, {})).toEqual({
      ok: true,
      value: { closed: true },
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it('does not expose a current link when the Research View is unavailable', async () => {
    const { invoke } = createHarness(undefined);

    expect(invoke(IPC.RESEARCH_CURRENT_LINK, {})).toMatchObject({
      ok: false,
      error: { code: 'RESEARCH_NOT_OPEN' },
    });
  });
});
