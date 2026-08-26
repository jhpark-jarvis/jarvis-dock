import type { IpcMain, IpcMainInvokeEvent, OpenDialogOptions } from 'electron';
import { mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  DocumentRequestSchema,
  DocumentResultSchema,
  DocumentWriteRequestSchema,
  IPC,
  WorkspaceChooseRequestSchema,
  WorkspaceChooseResultSchema,
  WorkspaceOpenFolderRequestSchema,
  WorkspaceOpenFolderResultEnvelopeSchema,
  WorkspaceRequestSchema,
  WorkspaceFilesResultSchema,
  WriteResultEnvelopeSchema,
  type DockError,
} from '../shared/ipc';
import {
  createDocument,
  createWorkspaceStore,
  listMarkdownFiles,
  readDocument,
  registerWorkspace,
  resolveWorkspacePath,
  writeDocument,
  type WorkspaceStore,
} from './workspace-service';

type HandlerRegistrar = Pick<IpcMain, 'handle'>;
type Dialog = {
  showOpenDialog: (
    options: OpenDialogOptions,
  ) => Promise<{ canceled: boolean; filePaths: string[] }>;
};

export interface WorkspaceHandlerDependencies {
  ipcMain: HandlerRegistrar;
  dialog: Dialog;
  isTrustedSender: (senderUrl: string) => boolean;
  store?: WorkspaceStore;
  documentWriter?: typeof writeDocument;
  openPath?: (path: string) => Promise<string>;
}

const error = (code: DockError['code'], message: string): DockError => ({
  code,
  message,
});
const unauthorized = () =>
  error('UNAUTHORIZED_SENDER', 'The Dock request is not authorized.');
const invalid = () => error('INVALID_REQUEST', 'The Dock request is invalid.');

const guard = (
  event: IpcMainInvokeEvent,
  isTrustedSender: WorkspaceHandlerDependencies['isTrustedSender'],
  request: unknown,
  schema: { safeParse: (value: unknown) => { success: boolean } },
) => {
  if (!isTrustedSender(event.senderFrame.url)) return unauthorized();
  if (!schema.safeParse(request).success) return invalid();
  return undefined;
};

const mapFsError = (cause: unknown): DockError => {
  const code = (cause as NodeJS.ErrnoException)?.code;
  if (code === 'ENOENT')
    return error('NOT_FOUND', 'The requested file or folder was not found.');
  if (code === 'EACCES' || code === 'EPERM')
    return error('PERMISSION_DENIED', 'Permission was denied.');
  if (code === 'EEXIST')
    return error('WRITE_FAILED', 'The document already exists.');
  return error('WRITE_FAILED', 'The document could not be saved.');
};

export const registerWorkspaceHandlers = ({
  ipcMain,
  dialog,
  isTrustedSender,
  store = createWorkspaceStore(),
  documentWriter = writeDocument,
  openPath = async () => '',
}: WorkspaceHandlerDependencies): void => {
  ipcMain.handle(IPC.WORKSPACE_CHOOSE, async (event, request) => {
    const guardError = guard(
      event,
      isTrustedSender,
      request,
      WorkspaceChooseRequestSchema,
    );
    if (guardError)
      return WorkspaceChooseResultSchema.parse({
        ok: false,
        error: guardError,
      });
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return WorkspaceChooseResultSchema.parse({
        ok: false,
        error: error('CANCELLED', 'Folder selection was cancelled.'),
      });
    }
    try {
      return WorkspaceChooseResultSchema.parse({
        ok: true,
        value: await registerWorkspace(store, result.filePaths[0]),
      });
    } catch (cause) {
      return WorkspaceChooseResultSchema.parse({
        ok: false,
        error: mapFsError(cause),
      });
    }
  });

  ipcMain.handle(IPC.WORKSPACE_OPEN_FOLDER, async (event, request) => {
    const guardError = guard(
      event,
      isTrustedSender,
      request,
      WorkspaceOpenFolderRequestSchema,
    );
    if (guardError)
      return WorkspaceOpenFolderResultEnvelopeSchema.parse({
        ok: false,
        error: guardError,
      });
    const parsed = WorkspaceOpenFolderRequestSchema.parse(request);
    const storedRoot = store.get(parsed.workspaceId);
    if (!storedRoot)
      return WorkspaceOpenFolderResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'WORKSPACE_NOT_SELECTED',
          'No document workspace is selected.',
        ),
      });
    try {
      const root = await realpath(storedRoot);
      const target =
        parsed.folder === 'assets' ? path.join(root, 'assets') : root;
      if (parsed.folder === 'assets') await mkdir(target, { recursive: true });
      const openError = await openPath(target);
      if (openError)
        return WorkspaceOpenFolderResultEnvelopeSchema.parse({
          ok: false,
          error: error('FOLDER_OPEN_FAILED', 'The folder could not be opened.'),
        });
      return WorkspaceOpenFolderResultEnvelopeSchema.parse({
        ok: true,
        value: { opened: true },
      });
    } catch (cause) {
      return WorkspaceOpenFolderResultEnvelopeSchema.parse({
        ok: false,
        error: mapFsError(cause),
      });
    }
  });

  ipcMain.handle(IPC.WORKSPACE_LIST_MARKDOWN_FILES, async (event, request) => {
    const guardError = guard(
      event,
      isTrustedSender,
      request,
      WorkspaceRequestSchema,
    );
    if (guardError)
      return WorkspaceFilesResultSchema.parse({ ok: false, error: guardError });
    const parsed = WorkspaceRequestSchema.parse(request);
    const root = store.get(parsed.workspaceId);
    if (!root)
      return WorkspaceFilesResultSchema.parse({
        ok: false,
        error: error(
          'WORKSPACE_NOT_SELECTED',
          'No document workspace is selected.',
        ),
      });
    try {
      return WorkspaceFilesResultSchema.parse({
        ok: true,
        value: { files: await listMarkdownFiles(root) },
      });
    } catch (cause) {
      return WorkspaceFilesResultSchema.parse({
        ok: false,
        error: mapFsError(cause),
      });
    }
  });

  ipcMain.handle(IPC.DOCUMENT_READ, async (event, request) => {
    const guardError = guard(
      event,
      isTrustedSender,
      request,
      DocumentRequestSchema,
    );
    if (guardError)
      return DocumentResultSchema.parse({ ok: false, error: guardError });
    const parsed = DocumentRequestSchema.parse(request);
    try {
      const resolved = await resolveWorkspacePath(
        store,
        parsed.workspaceId,
        parsed.relativePath,
        true,
      );
      if (!resolved)
        return DocumentResultSchema.parse({
          ok: false,
          error: error(
            store.has(parsed.workspaceId)
              ? 'PATH_OUTSIDE_WORKSPACE'
              : 'WORKSPACE_NOT_SELECTED',
            'The document path is not available.',
          ),
        });
      return DocumentResultSchema.parse({
        ok: true,
        value: await readDocument(resolved.absolutePath, parsed.relativePath),
      });
    } catch (cause) {
      return DocumentResultSchema.parse({
        ok: false,
        error: mapFsError(cause),
      });
    }
  });

  const handleWrite = async (
    event: IpcMainInvokeEvent,
    request: unknown,
    create: boolean,
  ) => {
    const guardError = guard(
      event,
      isTrustedSender,
      request,
      create ? DocumentRequestSchema : DocumentWriteRequestSchema,
    );
    if (guardError)
      return WriteResultEnvelopeSchema.parse({ ok: false, error: guardError });
    const parsed = (
      create ? DocumentRequestSchema : DocumentWriteRequestSchema
    ).parse(request);
    try {
      const resolved = await resolveWorkspacePath(
        store,
        parsed.workspaceId,
        parsed.relativePath,
        false,
      );
      if (!resolved)
        return WriteResultEnvelopeSchema.parse({
          ok: false,
          error: error(
            store.has(parsed.workspaceId)
              ? 'PATH_OUTSIDE_WORKSPACE'
              : 'WORKSPACE_NOT_SELECTED',
            'The document path is not available.',
          ),
        });
      if (!/\.(md|markdown)$/i.test(parsed.relativePath))
        return WriteResultEnvelopeSchema.parse({
          ok: false,
          error: error(
            'UNSUPPORTED_FILE',
            'Only Markdown documents are supported.',
          ),
        });
      const value = create
        ? await createDocument(resolved.absolutePath, parsed.relativePath)
        : await documentWriter(
            resolved.absolutePath,
            parsed.relativePath,
            (parsed as unknown as { content: string }).content,
          );
      return WriteResultEnvelopeSchema.parse({ ok: true, value });
    } catch (cause) {
      return WriteResultEnvelopeSchema.parse({
        ok: false,
        error: mapFsError(cause),
      });
    }
  };
  ipcMain.handle(IPC.DOCUMENT_CREATE, (event, request) =>
    handleWrite(event, request, true),
  );
  ipcMain.handle(IPC.DOCUMENT_WRITE, (event, request) =>
    handleWrite(event, request, false),
  );
};
