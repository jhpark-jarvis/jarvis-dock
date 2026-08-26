import type { IpcMainInvokeEvent } from 'electron';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../shared/ipc';
import { createWorkspaceStore } from './workspace-service';
import {
  registerWorkspaceHandlers,
  type WorkspaceHandlerDependencies,
} from './workspace-handlers';

type InvokeHandler = (event: IpcMainInvokeEvent, request: unknown) => unknown;

const createHarness = (
  folder: string | undefined,
  overrides: Pick<
    WorkspaceHandlerDependencies,
    'documentWriter' | 'openPath'
  > = {},
) => {
  const handlers = new Map<string, InvokeHandler>();
  const handle = vi.fn((channel: string, handler: InvokeHandler) =>
    handlers.set(channel, handler),
  );
  registerWorkspaceHandlers({
    ipcMain: { handle },
    dialog: {
      showOpenDialog: vi.fn(async () =>
        folder
          ? { canceled: false, filePaths: [folder] }
          : { canceled: true, filePaths: [] },
      ),
    },
    isTrustedSender: (url) => url === 'http://localhost:5173/',
    store: createWorkspaceStore(),
    ...overrides,
  });
  const invoke = (channel: string, request: unknown) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`No handler registered for ${channel}`);
    return handler(
      { senderFrame: { url: 'http://localhost:5173/' } } as IpcMainInvokeEvent,
      request,
    );
  };
  return { handle, invoke };
};

describe('registerWorkspaceHandlers', () => {
  it('registers the workspace and document channels', () => {
    const { handle } = createHarness(undefined);
    expect(handle).toHaveBeenCalledTimes(6);
    expect(handle.mock.calls.map(([channel]) => channel)).toEqual([
      IPC.WORKSPACE_CHOOSE,
      IPC.WORKSPACE_OPEN_FOLDER,
      IPC.WORKSPACE_LIST_MARKDOWN_FILES,
      IPC.DOCUMENT_READ,
      IPC.DOCUMENT_CREATE,
      IPC.DOCUMENT_WRITE,
    ]);
  });

  it('opens the selected document or assets folder without exposing a path', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'jarvis-dock-handler-open-folder-'),
    );
    const openPath = vi.fn(async () => '');
    const { invoke } = createHarness(root, { openPath });

    try {
      const chosen = (await invoke(IPC.WORKSPACE_CHOOSE, {})) as {
        value: { workspaceId: string };
      };
      await expect(
        invoke(IPC.WORKSPACE_OPEN_FOLDER, {
          workspaceId: chosen.value.workspaceId,
          folder: 'document',
        }),
      ).resolves.toEqual({ ok: true, value: { opened: true } });
      await expect(
        invoke(IPC.WORKSPACE_OPEN_FOLDER, {
          workspaceId: chosen.value.workspaceId,
          folder: 'assets',
        }),
      ).resolves.toEqual({ ok: true, value: { opened: true } });
      expect(openPath).toHaveBeenNthCalledWith(1, await fs.realpath(root));
      expect(openPath).toHaveBeenNthCalledWith(
        2,
        path.join(await fs.realpath(root), 'assets'),
      );
      await expect(fs.stat(path.join(root, 'assets'))).resolves.toBeTruthy();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('returns CANCELLED when the user closes the folder dialog', async () => {
    const { invoke } = createHarness(undefined);
    await expect(invoke(IPC.WORKSPACE_CHOOSE, {})).resolves.toEqual({
      ok: false,
      error: { code: 'CANCELLED', message: 'Folder selection was cancelled.' },
    });
  });

  it('does not expose a selected folder path and allows a markdown round trip', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'jarvis-dock-handler-'),
    );
    const { invoke } = createHarness(root);
    const chosen = await invoke(IPC.WORKSPACE_CHOOSE, {});
    expect(chosen).toMatchObject({
      ok: true,
      value: { displayName: path.basename(root) },
    });
    expect(JSON.stringify(chosen)).not.toContain(root);
    const workspaceId = (chosen as { value: { workspaceId: string } }).value
      .workspaceId;
    await expect(
      invoke(IPC.DOCUMENT_CREATE, { workspaceId, relativePath: 'note.md' }),
    ).resolves.toMatchObject({
      ok: true,
      value: { relativePath: 'note.md', savedAt: expect.any(String) },
    });
    await expect(
      invoke(IPC.DOCUMENT_WRITE, {
        workspaceId,
        relativePath: 'note.md',
        content: '# Hello',
      }),
    ).resolves.toMatchObject({ ok: true, value: { bytesWritten: 7 } });
    await expect(
      invoke(IPC.DOCUMENT_READ, { workspaceId, relativePath: 'note.md' }),
    ).resolves.toMatchObject({
      ok: true,
      value: { content: '# Hello', encoding: 'utf-8' },
    });
  });

  it('rejects an invalid workspace request before filesystem access', async () => {
    const { invoke } = createHarness(undefined);
    await expect(
      invoke(IPC.WORKSPACE_LIST_MARKDOWN_FILES, { workspaceId: 'not-a-uuid' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
  });

  it('maps document writer failures without reporting a successful save', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'jarvis-dock-handler-write-failure-'),
    );
    await fs.writeFile(path.join(root, 'note.md'), '# Before', 'utf8');
    const { invoke } = createHarness(root, {
      documentWriter: async () => {
        throw Object.assign(new Error('Write denied.'), { code: 'EACCES' });
      },
    });
    const chosen = (await invoke(IPC.WORKSPACE_CHOOSE, {})) as {
      value: { workspaceId: string };
    };

    try {
      await expect(
        invoke(IPC.DOCUMENT_WRITE, {
          workspaceId: chosen.value.workspaceId,
          relativePath: 'note.md',
          content: '# After',
        }),
      ).resolves.toEqual({
        ok: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Permission was denied.',
        },
      });
      await expect(
        fs.readFile(path.join(root, 'note.md'), 'utf8'),
      ).resolves.toBe('# Before');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
