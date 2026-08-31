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

  it('validates and invokes fixed Research View channels', async () => {
    const invoke = vi.fn(async (channel: string) =>
      channel === IPC.RESEARCH_CLOSE
        ? { ok: true, value: { closed: true } }
        : channel === IPC.RESEARCH_SET_VISIBLE
          ? { ok: true, value: { updated: true } }
          : {
              ok: true,
              value: {
                opened: true,
                results: [
                  {
                    title: 'Electron Security',
                    url: 'https://www.electronjs.org/docs/latest/tutorial/security',
                  },
                ],
              },
            },
    );
    const dock = createDockApi({ invoke });

    await expect(
      dock.research.open({ query: 'electron' }),
    ).resolves.toMatchObject({ ok: true });
    expect(invoke).toHaveBeenCalledWith(IPC.RESEARCH_OPEN, {
      query: 'electron',
    });
    await expect(dock.research.close()).resolves.toMatchObject({ ok: true });
    expect(invoke).toHaveBeenCalledWith(IPC.RESEARCH_CLOSE, {});
    await expect(
      dock.research.setVisible({ visible: false }),
    ).resolves.toMatchObject({ ok: true });
    expect(invoke).toHaveBeenCalledWith(IPC.RESEARCH_SET_VISIBLE, {
      visible: false,
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

  it('validates and invokes the fixed image search channel', async () => {
    const invoke = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        results: [
          {
            id: '42',
            title: 'Electron security.png',
            sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Electron',
            thumbnailUrl: 'https://upload.wikimedia.org/thumb.png',
            downloadUrl: 'https://upload.wikimedia.org/image.png',
            source: 'Wikimedia Commons',
            license: 'CC BY-SA 4.0',
          },
        ],
      },
    });
    const dock = createDockApi({ invoke });

    await expect(
      dock.image.search({ query: 'electron' }),
    ).resolves.toMatchObject({ ok: true });
    expect(invoke).toHaveBeenCalledWith(IPC.SEARCH_IMAGES, {
      query: 'electron',
    });
  });

  it('validates and invokes image asset read, delete, and clipboard channels', async () => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === IPC.IMAGE_LIST_ASSETS) {
        return {
          ok: true,
          value: {
            assets: [
              { assetPath: 'assets/diagram.png', displayName: 'diagram.png' },
            ],
          },
        };
      }
      if (channel === IPC.IMAGE_READ_ASSET) {
        return {
          ok: true,
          value: {
            assetPath: 'assets/diagram.png',
            dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
            mimeType: 'image/png',
          },
        };
      }
      if (channel === IPC.IMAGE_DELETE_ASSET) {
        return {
          ok: true,
          value: { assetPath: 'assets/diagram.png', deleted: true },
        };
      }
      return {
        ok: true,
        value: {
          assetPath: 'assets/pasted-image.png',
          bytesWritten: 8,
          mimeType: 'image/png',
        },
      };
    });
    const dock = createDockApi({ invoke });
    const assetRequest = {
      workspaceId: '11111111-1111-4111-8111-111111111111',
      assetPath: 'assets/diagram.png',
    };

    await expect(
      dock.image.list({ workspaceId: assetRequest.workspaceId }),
    ).resolves.toMatchObject({ ok: true });
    await expect(dock.image.read(assetRequest)).resolves.toMatchObject({
      ok: true,
    });
    await expect(dock.image.delete(assetRequest)).resolves.toMatchObject({
      ok: true,
    });
    await expect(
      dock.image.saveClipboard({
        workspaceId: assetRequest.workspaceId,
        relativePath: 'guide.md',
        mimeType: 'image/png',
        bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(invoke).toHaveBeenNthCalledWith(1, IPC.IMAGE_LIST_ASSETS, {
      workspaceId: assetRequest.workspaceId,
    });
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      IPC.IMAGE_READ_ASSET,
      assetRequest,
    );
    expect(invoke).toHaveBeenNthCalledWith(
      3,
      IPC.IMAGE_DELETE_ASSET,
      assetRequest,
    );
    expect(invoke).toHaveBeenNthCalledWith(4, IPC.IMAGE_SAVE_CLIPBOARD, {
      workspaceId: assetRequest.workspaceId,
      relativePath: 'guide.md',
      mimeType: 'image/png',
      bytes: expect.any(Uint8Array),
    });
  });

  it('validates and invokes the selected workspace folder channel', async () => {
    const invoke = vi.fn().mockResolvedValue({
      ok: true,
      value: { opened: true },
    });
    const dock = createDockApi({ invoke });
    const request = {
      workspaceId: '11111111-1111-4111-8111-111111111111',
      folder: 'assets' as const,
    };

    await expect(dock.workspace.openFolder(request)).resolves.toEqual({
      ok: true,
      value: { opened: true },
    });
    expect(invoke).toHaveBeenCalledWith(IPC.WORKSPACE_OPEN_FOLDER, request);
  });

  it('validates and invokes the workspace move channel', async () => {
    const invoke = vi.fn().mockResolvedValue({
      ok: true,
      value: { relativePath: 'archive/note.md', kind: 'file' },
    });
    const dock = createDockApi({ invoke });
    const request = {
      workspaceId: '11111111-1111-4111-8111-111111111111',
      relativePath: 'docs/note.md',
      destinationParentPath: 'archive',
    };

    await expect(dock.workspace.moveEntry?.(request)).resolves.toMatchObject({
      ok: true,
    });
    expect(invoke).toHaveBeenCalledWith(IPC.WORKSPACE_MOVE_ENTRY, request);
  });

  it('validates workspace change events and removes the listener', () => {
    const invoke = vi.fn();
    const on = vi.fn();
    const removeListener = vi.fn();
    const dock = createDockApi({ invoke, on, removeListener });
    const listener = vi.fn();
    const unsubscribe = dock.workspace.onChanged?.(listener);
    const registered = on.mock.calls[0]?.[1] as
      | ((event: unknown, payload: unknown) => void)
      | undefined;

    registered?.({}, { workspaceId: 'not-a-uuid' });
    registered?.({}, { workspaceId: '11111111-1111-4111-8111-111111111111' });

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe?.();
    expect(removeListener).toHaveBeenCalledWith(
      IPC.WORKSPACE_CHANGED,
      registered,
    );
  });

  it('validates and invokes ADR creation through the fixed architecture channel', async () => {
    const invoke = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        relativePath: 'docs/adr/0002-record.md',
        adrNumber: 2,
        title: 'ADR',
        status: 'Accepted',
        indexUpdated: true,
      },
    });
    const dock = createDockApi({ invoke });
    const request = {
      workspaceId: '11111111-1111-4111-8111-111111111111',
      title: 'ADR',
      status: 'Accepted' as const,
      context: '배경',
      decision: '결정',
      consequences: '결과',
    };

    await expect(dock.architecture.createAdr(request)).resolves.toMatchObject({
      ok: true,
      value: { relativePath: 'docs/adr/0002-record.md' },
    });
    expect(invoke).toHaveBeenCalledWith(IPC.ARCHITECTURE_CREATE_ADR, request);
  });

  it('exposes only the bounded runtime event recorder', async () => {
    const invoke = vi.fn().mockResolvedValue({
      ok: true,
      value: { recorded: true },
    });
    const dock = createDockApi({ invoke });

    await dock.runtime.recordEvent({
      event: 'preview-rendered',
      details: { bytes: 2048, durationMs: 18, outcome: 'success' },
    });

    expect(invoke).toHaveBeenCalledWith(IPC.RUNTIME_RECORD_EVENT, {
      event: 'preview-rendered',
      details: { bytes: 2048, durationMs: 18, outcome: 'success' },
    });
  });
});
