import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../shared/ipc';
import { registerSystemHandlers } from './system-handlers';

type InvokeHandler = (event: IpcMainInvokeEvent, request: unknown) => unknown;

const createHarness = () => {
  const handlers = new Map<string, InvokeHandler>();
  const handle = vi.fn((channel: string, handler: InvokeHandler) => {
    handlers.set(channel, handler);
  });

  registerSystemHandlers({
    ipcMain: { handle },
    getVersion: () => '1.0.0',
    isTrustedSender: (url) => url === 'http://localhost:5173/',
  });

  const invoke = (channel: string, senderUrl: string, request: unknown) => {
    const handler = handlers.get(channel);

    if (!handler) {
      throw new Error(`No handler registered for ${channel}`);
    }

    return handler(
      { senderFrame: { url: senderUrl } } as IpcMainInvokeEvent,
      request,
    );
  };

  return { handle, invoke };
};

describe('registerSystemHandlers', () => {
  it('registers only the fixed bootstrap channels', () => {
    const { handle } = createHarness();

    expect(handle).toHaveBeenCalledTimes(2);
    expect(handle).toHaveBeenNthCalledWith(
      1,
      IPC.SYSTEM_HEALTH,
      expect.any(Function),
    );
    expect(handle).toHaveBeenNthCalledWith(
      2,
      IPC.SYSTEM_VERSION,
      expect.any(Function),
    );
  });

  it('returns the health result for a trusted empty request', () => {
    const { invoke } = createHarness();

    expect(invoke(IPC.SYSTEM_HEALTH, 'http://localhost:5173/', {})).toEqual({
      ok: true,
      value: { status: 'ok' },
    });
  });

  it('rejects an untrusted sender before handling the request', () => {
    const { invoke } = createHarness();

    expect(invoke(IPC.SYSTEM_HEALTH, 'https://example.com/', {})).toEqual({
      ok: false,
      error: {
        code: 'UNAUTHORIZED_SENDER',
        message: 'The Dock system request is not authorized.',
      },
    });
  });

  it('rejects a request that does not match the contract', () => {
    const { invoke } = createHarness();

    expect(
      invoke(IPC.SYSTEM_VERSION, 'http://localhost:5173/', { extra: true }),
    ).toEqual({
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'The Dock system request is invalid.',
      },
    });
  });
});
