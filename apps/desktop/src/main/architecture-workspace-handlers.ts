import type { IpcMain } from 'electron';
import {
  ArchitectureCheckProjectRequestSchema,
  ArchitectureCheckProjectResultEnvelopeSchema,
  ArchitectureCreateAdrRequestSchema,
  ArchitectureCreateAdrResultEnvelopeSchema,
  ArchitectureCreateProjectRequestSchema,
  ArchitectureCreateProjectResultEnvelopeSchema,
  IPC,
  type DockError,
} from '../shared/ipc';
import {
  ArchitectureWorkspaceConflictError,
  checkArchitectureDocuments,
  createAdrDocument,
  createArchitectureDocuments,
} from './architecture-workspace-service';
import { createWorkspaceStore, type WorkspaceStore } from './workspace-service';

type HandlerRegistrar = Pick<IpcMain, 'handle'>;

export interface ArchitectureWorkspaceHandlerDependencies {
  ipcMain: HandlerRegistrar;
  isTrustedSender: (senderUrl: string) => boolean;
  store?: WorkspaceStore;
  createDocuments?: typeof createArchitectureDocuments;
  checkDocuments?: typeof checkArchitectureDocuments;
  createAdr?: typeof createAdrDocument;
}

const error = (code: DockError['code'], message: string): DockError => ({
  code,
  message,
});

export const registerArchitectureWorkspaceHandlers = ({
  ipcMain,
  isTrustedSender,
  store = createWorkspaceStore(),
  createDocuments = createArchitectureDocuments,
  checkDocuments = checkArchitectureDocuments,
  createAdr = createAdrDocument,
}: ArchitectureWorkspaceHandlerDependencies): void => {
  ipcMain.handle(IPC.ARCHITECTURE_CREATE_PROJECT, async (event, request) => {
    if (!isTrustedSender(event.senderFrame.url)) {
      return ArchitectureCreateProjectResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'UNAUTHORIZED_SENDER',
          'The Dock request is not authorized.',
        ),
      });
    }
    const parsed = ArchitectureCreateProjectRequestSchema.safeParse(request);
    if (!parsed.success) {
      return ArchitectureCreateProjectResultEnvelopeSchema.parse({
        ok: false,
        error: error('INVALID_REQUEST', 'The Dock request is invalid.'),
      });
    }
    const root = store.get(parsed.data.workspaceId);
    if (!root) {
      return ArchitectureCreateProjectResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'WORKSPACE_NOT_SELECTED',
          'No document workspace is selected.',
        ),
      });
    }
    try {
      return ArchitectureCreateProjectResultEnvelopeSchema.parse(
        await createDocuments(root, parsed.data),
      );
    } catch (cause) {
      if (cause instanceof ArchitectureWorkspaceConflictError) {
        return ArchitectureCreateProjectResultEnvelopeSchema.parse({
          ok: false,
          error: error(
            'ARCHITECTURE_CONFLICT',
            `The architecture documents already exist: ${cause.paths.join(', ')}`,
          ),
        });
      }
      return ArchitectureCreateProjectResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'ARCHITECTURE_CREATE_FAILED',
          'The architecture documents could not be created.',
        ),
      });
    }
  });
  ipcMain.handle(IPC.ARCHITECTURE_CHECK_PROJECT, async (event, request) => {
    if (!isTrustedSender(event.senderFrame.url)) {
      return {
        ok: false as const,
        error: error(
          'UNAUTHORIZED_SENDER',
          'The Dock request is not authorized.',
        ),
      };
    }
    const parsed = ArchitectureCheckProjectRequestSchema.safeParse(request);
    if (!parsed.success) {
      return {
        ok: false as const,
        error: error('INVALID_REQUEST', 'The Dock request is invalid.'),
      };
    }
    const root = store.get(parsed.data.workspaceId);
    if (!root) {
      return {
        ok: false as const,
        error: error(
          'WORKSPACE_NOT_SELECTED',
          'No document workspace is selected.',
        ),
      };
    }
    try {
      return ArchitectureCheckProjectResultEnvelopeSchema.parse(
        await checkDocuments(root),
      );
    } catch {
      return ArchitectureCheckProjectResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'ARCHITECTURE_CREATE_FAILED',
          'The architecture documents could not be checked.',
        ),
      });
    }
  });
  ipcMain.handle(IPC.ARCHITECTURE_CREATE_ADR, async (event, request) => {
    if (!isTrustedSender(event.senderFrame.url)) {
      return ArchitectureCreateAdrResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'UNAUTHORIZED_SENDER',
          'The Dock request is not authorized.',
        ),
      });
    }
    const parsed = ArchitectureCreateAdrRequestSchema.safeParse(request);
    if (!parsed.success) {
      return ArchitectureCreateAdrResultEnvelopeSchema.parse({
        ok: false,
        error: error('INVALID_REQUEST', 'The Dock request is invalid.'),
      });
    }
    const root = store.get(parsed.data.workspaceId);
    if (!root) {
      return ArchitectureCreateAdrResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'WORKSPACE_NOT_SELECTED',
          'No document workspace is selected.',
        ),
      });
    }
    try {
      return ArchitectureCreateAdrResultEnvelopeSchema.parse(
        await createAdr(root, parsed.data),
      );
    } catch (cause) {
      if (cause instanceof ArchitectureWorkspaceConflictError) {
        return ArchitectureCreateAdrResultEnvelopeSchema.parse({
          ok: false,
          error: error(
            'ARCHITECTURE_CONFLICT',
            `The ADR already exists: ${cause.paths.join(', ')}`,
          ),
        });
      }
      return ArchitectureCreateAdrResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'ARCHITECTURE_CREATE_FAILED',
          'The ADR could not be created.',
        ),
      });
    }
  });
};
