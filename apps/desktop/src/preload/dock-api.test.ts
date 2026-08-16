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
});
