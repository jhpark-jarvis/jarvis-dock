import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../shared/ipc';
import { RuntimeTelemetry } from './runtime-telemetry';
import { registerRuntimeHandlers } from './runtime-handlers';

describe('registerRuntimeHandlers', () => {
  it('validates trusted runtime events before recording them', () => {
    const handlers = new Map<
      string,
      (event: IpcMainInvokeEvent, request: unknown) => unknown
    >();
    const handle = vi.fn((channel, handler) => handlers.set(channel, handler));
    const recordAction = vi.fn();
    registerRuntimeHandlers({
      ipcMain: { handle },
      telemetry: { recordAction } as unknown as RuntimeTelemetry,
      isTrustedSender: (url) => url === 'http://localhost:5173/',
    });
    const invoke = (url: string, request: unknown) =>
      handlers.get(IPC.RUNTIME_RECORD_EVENT)?.(
        { senderFrame: { url } } as IpcMainInvokeEvent,
        request,
      );

    expect(
      invoke('http://localhost:5173/', {
        event: 'document-opened',
        details: { bytes: 128, outcome: 'success' },
      }),
    ).toEqual({ ok: true, value: { recorded: true } });
    expect(recordAction).toHaveBeenCalledWith('document-opened', {
      bytes: 128,
      outcome: 'success',
    });
    expect(
      invoke('https://example.com/', { event: 'document-opened' }),
    ).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED_SENDER' } });
    expect(
      invoke('http://localhost:5173/', { event: 'document-content' }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
  });
});
