import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IPC } from '../shared/ipc';
import { registerImageAssetHandlers } from './image-asset-handlers';

type InvokeHandler = (event: IpcMainInvokeEvent, request: unknown) => unknown;

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

const createHarness = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-dock-assets-'));
  roots.push(root);
  await fs.mkdir(path.join(root, 'assets'));
  await fs.writeFile(path.join(root, 'guide.md'), '# Guide');
  await fs.writeFile(path.join(root, 'assets', 'diagram.png'), PNG_BYTES);
  const realRoot = await fs.realpath(root);
  const store = new Map([[WORKSPACE_ID, realRoot]]);
  const handlers = new Map<string, InvokeHandler>();
  const handle = vi.fn((channel: string, handler: InvokeHandler) =>
    handlers.set(channel, handler),
  );
  registerImageAssetHandlers({
    ipcMain: { handle },
    isTrustedSender: (url) => url === 'http://localhost:5173/',
    store,
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
  return { handle, invoke, realRoot };
};

describe('registerImageAssetHandlers', () => {
  it('validates the sender and request before reading an asset', async () => {
    const { handle, invoke } = await createHarness();

    expect(handle).toHaveBeenCalledWith(
      IPC.IMAGE_READ_ASSET,
      expect.any(Function),
    );
    await expect(
      invoke(IPC.IMAGE_READ_ASSET, { workspaceId: 'bad' }, false),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED_SENDER' },
    });
    await expect(
      invoke(IPC.IMAGE_READ_ASSET, { workspaceId: 'bad' }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST' },
    });
  });

  it('lists image assets only for a trusted selected workspace', async () => {
    const { handle, invoke } = await createHarness();

    expect(handle).toHaveBeenCalledWith(
      IPC.IMAGE_LIST_ASSETS,
      expect.any(Function),
    );
    await expect(
      invoke(IPC.IMAGE_LIST_ASSETS, { workspaceId: WORKSPACE_ID }),
    ).resolves.toEqual({
      ok: true,
      value: {
        assets: [
          { assetPath: 'assets/diagram.png', displayName: 'diagram.png' },
        ],
      },
    });
    await expect(
      invoke(IPC.IMAGE_LIST_ASSETS, { workspaceId: WORKSPACE_ID }, false),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED_SENDER' },
    });
  });

  it('reads an asset as a validated data URL', async () => {
    const { invoke } = await createHarness();

    await expect(
      invoke(IPC.IMAGE_READ_ASSET, {
        workspaceId: WORKSPACE_ID,
        assetPath: 'assets/diagram.png',
      }),
    ).resolves.toEqual({
      ok: true,
      value: {
        assetPath: 'assets/diagram.png',
        dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
        mimeType: 'image/png',
      },
    });
  });

  it('saves clipboard bytes through the same validated asset writer', async () => {
    const { invoke, realRoot } = await createHarness();

    await expect(
      invoke(IPC.IMAGE_SAVE_CLIPBOARD, {
        workspaceId: WORKSPACE_ID,
        relativePath: 'guide.md',
        mimeType: 'image/png',
        bytes: PNG_BYTES,
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        assetPath: 'assets/pasted-image.png',
        mimeType: 'image/png',
      },
    });
    await expect(
      fs.stat(path.join(realRoot, 'assets', 'pasted-image.png')),
    ).resolves.toBeTruthy();
  });
});
