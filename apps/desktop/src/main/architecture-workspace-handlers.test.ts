import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../shared/ipc';
import { createWorkspaceStore } from './workspace-service';
import { registerArchitectureWorkspaceHandlers } from './architecture-workspace-handlers';

type InvokeHandler = (event: IpcMainInvokeEvent, request: unknown) => unknown;

const createHarness = () => {
  const handlers = new Map<string, InvokeHandler>();
  const handle = vi.fn((channel: string, handler: InvokeHandler) =>
    handlers.set(channel, handler),
  );
  const store = createWorkspaceStore();
  store.set('11111111-1111-4111-8111-111111111111', 'C:\\workspace');
  registerArchitectureWorkspaceHandlers({
    ipcMain: { handle },
    isTrustedSender: (url) => url === 'http://localhost:5173/',
    store,
    createDocuments: vi.fn(async (_root, request) => ({
      ok: true as const,
      value: {
        projectName: request.projectName,
        files: [
          {
            relativePath: 'docs/architecture/arc42.md' as const,
            bytesWritten: 10,
          },
          {
            relativePath: 'docs/architecture/c4-context.md' as const,
            bytesWritten: 10,
          },
          {
            relativePath: 'docs/architecture/c4-container.md' as const,
            bytesWritten: 10,
          },
          {
            relativePath: 'docs/architecture/c4-component.md' as const,
            bytesWritten: 10,
          },
          { relativePath: 'docs/adr/README.md' as const, bytesWritten: 10 },
          {
            relativePath: 'docs/adr/0001-initial-architecture.md' as const,
            bytesWritten: 10,
          },
        ],
      },
    })),
    createAdr: vi.fn(async (_root, request) => ({
      ok: true as const,
      value: {
        relativePath: 'docs/adr/0002-record.md',
        adrNumber: 2,
        title: request.title,
        status: request.status,
        indexUpdated: true as const,
      },
    })),
  });
  const invoke = (request: unknown, url = 'http://localhost:5173/') =>
    handlers.get(IPC.ARCHITECTURE_CREATE_PROJECT)?.(
      { senderFrame: { url } } as IpcMainInvokeEvent,
      request,
    );
  const invokeAdr = (request: unknown, url = 'http://localhost:5173/') =>
    handlers.get(IPC.ARCHITECTURE_CREATE_ADR)?.(
      { senderFrame: { url } } as IpcMainInvokeEvent,
      request,
    );
  return { handle, invoke, invokeAdr };
};

describe('architecture workspace handlers', () => {
  it('registers a narrow channel and validates the selected document workspace', async () => {
    const { handle, invoke } = createHarness();
    expect(handle).toHaveBeenCalledWith(
      IPC.ARCHITECTURE_CREATE_PROJECT,
      expect.any(Function),
    );

    await expect(
      invoke({
        projectName: 'Dock',
        purpose: '문서화',
        techStack: 'TypeScript',
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST' },
    });
    await expect(
      invoke({
        workspaceId: '22222222-2222-4222-8222-222222222222',
        projectName: 'Dock',
        purpose: '문서화',
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'WORKSPACE_NOT_SELECTED' },
    });
  });

  it('passes only validated project data to the Main document generator', async () => {
    const { invoke } = createHarness();

    await expect(
      invoke({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        projectName: 'Dock',
        purpose: '문서화',
        techStack: 'TypeScript',
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: { projectName: 'Dock', files: expect.arrayContaining([]) },
    });
  });

  it('validates the ADR request and forwards only selected workspace data', async () => {
    const { handle, invokeAdr } = createHarness();
    expect(handle).toHaveBeenCalledWith(
      IPC.ARCHITECTURE_CREATE_ADR,
      expect.any(Function),
    );

    await expect(
      invokeAdr({ title: '누락된 workspaceId' }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST' },
    });
    await expect(
      invokeAdr({
        workspaceId: '22222222-2222-4222-8222-222222222222',
        title: 'ADR',
        status: 'Accepted',
        context: '배경',
        decision: '결정',
        consequences: '결과',
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'WORKSPACE_NOT_SELECTED' },
    });
    await expect(
      invokeAdr({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        title: 'ADR',
        status: 'Accepted',
        context: '배경',
        decision: '결정',
        consequences: '결과',
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        relativePath: 'docs/adr/0002-record.md',
        title: 'ADR',
        status: 'Accepted',
        indexUpdated: true,
      },
    });
  });
});
