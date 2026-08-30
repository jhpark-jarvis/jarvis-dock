import type { IpcMain, IpcMainInvokeEvent, OpenDialogOptions } from 'electron';
import { lstat, mkdir, readFile, realpath } from 'node:fs/promises';
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
  WorkspaceEntriesResultSchema,
  WorkspaceCreateEntryRequestSchema,
  WorkspaceRenameEntryRequestSchema,
  WorkspaceMoveEntryRequestSchema,
  WorkspaceDeleteEntryRequestSchema,
  WorkspaceMutationResultEnvelopeSchema,
  WriteResultEnvelopeSchema,
  type DockError,
} from '../shared/ipc';
import {
  createDocument,
  createWorkspaceStore,
  listMarkdownFiles,
  listWorkspaceEntries,
  createWorkspaceDirectory,
  renameWorkspaceEntry,
  moveWorkspaceEntry,
  deleteWorkspaceEntry,
  readDocument,
  registerWorkspace,
  resolveWorkspacePath,
  isInside,
  writeDocument,
  getDocumentRevision,
  type WorkspaceStore,
} from './workspace-service';
import { WorkspaceWatcher } from './workspace-watcher';

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
  sendWorkspaceChanged?: (workspaceId: string) => void;
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
  sendWorkspaceChanged,
}: WorkspaceHandlerDependencies): (() => void) => {
  const watchers = new Map<string, WorkspaceWatcher>();
  const startWatcher = async (workspaceId: string, root: string) => {
    if (!sendWorkspaceChanged) return;
    watchers.get(workspaceId)?.dispose();
    const watcher = new WorkspaceWatcher(root, () =>
      sendWorkspaceChanged(workspaceId),
    );
    watchers.set(workspaceId, watcher);
    await watcher.start();
  };
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
      const workspace = await registerWorkspace(store, result.filePaths[0]);
      const registeredRoot = store.get(workspace.workspaceId);
      if (!registeredRoot)
        throw new Error('The workspace could not be registered.');
      await startWatcher(workspace.workspaceId, registeredRoot);
      return WorkspaceChooseResultSchema.parse({
        ok: true,
        value: workspace,
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

  ipcMain.handle(IPC.WORKSPACE_LIST_ENTRIES, async (event, request) => {
    const guardError = guard(
      event,
      isTrustedSender,
      request,
      WorkspaceRequestSchema,
    );
    if (guardError)
      return WorkspaceEntriesResultSchema.parse({
        ok: false,
        error: guardError,
      });
    const parsed = WorkspaceRequestSchema.parse(request);
    const root = store.get(parsed.workspaceId);
    if (!root)
      return WorkspaceEntriesResultSchema.parse({
        ok: false,
        error: error(
          'WORKSPACE_NOT_SELECTED',
          'No document workspace is selected.',
        ),
      });
    try {
      return WorkspaceEntriesResultSchema.parse({
        ok: true,
        value: { entries: await listWorkspaceEntries(root) },
      });
    } catch (cause) {
      return WorkspaceEntriesResultSchema.parse({
        ok: false,
        error: mapFsError(cause),
      });
    }
  });

  const workspaceMutation = async (
    event: IpcMainInvokeEvent,
    request: unknown,
    operation: 'create' | 'rename' | 'move' | 'delete',
  ) => {
    const schema =
      operation === 'create'
        ? WorkspaceCreateEntryRequestSchema
        : operation === 'rename'
          ? WorkspaceRenameEntryRequestSchema
          : operation === 'move'
            ? WorkspaceMoveEntryRequestSchema
            : WorkspaceDeleteEntryRequestSchema;
    const guardError = guard(event, isTrustedSender, request, schema);
    if (guardError)
      return WorkspaceMutationResultEnvelopeSchema.parse({
        ok: false,
        error: guardError,
      });
    const parsed = schema.parse(request) as {
      workspaceId: string;
      parentPath?: string;
      relativePath?: string;
      name?: string;
      newName?: string;
      destinationParentPath?: string;
      kind?: 'file' | 'directory';
    };
    const root = store.get(parsed.workspaceId);
    if (!root)
      return WorkspaceMutationResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'WORKSPACE_NOT_SELECTED',
          'No document workspace is selected.',
        ),
      });
    try {
      if (operation === 'create') {
        const parentPath = parsed.parentPath ?? '';
        const name = parsed.name ?? '';
        const kind = parsed.kind ?? 'file';
        const parent = await resolveWorkspacePath(
          store,
          parsed.workspaceId,
          parentPath || '.',
          true,
        );
        if (!parent || !(await lstat(parent.absolutePath)).isDirectory())
          return WorkspaceMutationResultEnvelopeSchema.parse({
            ok: false,
            error: error(
              'DIRECTORY_NOT_FOUND',
              'The parent folder was not found.',
            ),
          });
        const relativePath = parentPath ? `${parentPath}/${name}` : name;
        const target = await resolveWorkspacePath(
          store,
          parsed.workspaceId,
          relativePath,
          false,
        );
        if (!target) throw new Error('Target path is outside the workspace.');
        if (kind === 'directory')
          await createWorkspaceDirectory(target.absolutePath);
        else {
          if (!/\.(md|markdown)$/i.test(name))
            return WorkspaceMutationResultEnvelopeSchema.parse({
              ok: false,
              error: error(
                'UNSUPPORTED_FILE',
                'Only Markdown files can be created.',
              ),
            });
          await createDocument(target.absolutePath, relativePath);
        }
        return WorkspaceMutationResultEnvelopeSchema.parse({
          ok: true,
          value: { relativePath, kind },
        });
      }
      const relativePath = parsed.relativePath ?? '';
      const current = await resolveWorkspacePath(
        store,
        parsed.workspaceId,
        relativePath,
        true,
      );
      if (!current || current.absolutePath === current.root)
        return WorkspaceMutationResultEnvelopeSchema.parse({
          ok: false,
          error: error(
            'PATH_OUTSIDE_WORKSPACE',
            'The workspace root cannot be changed.',
          ),
        });
      const currentStats = await lstat(current.absolutePath);
      if (operation === 'move') {
        const destinationParentPath = parsed.destinationParentPath ?? '';
        let destinationParent:
          | { root: string; absolutePath: string }
          | undefined;
        try {
          destinationParent = await resolveWorkspacePath(
            store,
            parsed.workspaceId,
            destinationParentPath || '.',
            true,
          );
        } catch (cause) {
          if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
            return WorkspaceMutationResultEnvelopeSchema.parse({
              ok: false,
              error: error(
                'DIRECTORY_NOT_FOUND',
                'The destination folder was not found.',
              ),
            });
          }
          throw cause;
        }
        if (
          !destinationParent ||
          !(await lstat(destinationParent.absolutePath)).isDirectory()
        )
          return WorkspaceMutationResultEnvelopeSchema.parse({
            ok: false,
            error: error(
              'DIRECTORY_NOT_FOUND',
              'The destination folder was not found.',
            ),
          });
        const currentRealPath = await realpath(current.absolutePath);
        const destinationParentRealPath = await realpath(
          destinationParent.absolutePath,
        );
        if (
          currentStats.isDirectory() &&
          isInside(currentRealPath, destinationParentRealPath)
        )
          return WorkspaceMutationResultEnvelopeSchema.parse({
            ok: false,
            error: error(
              'INVALID_REQUEST',
              'An entry cannot be moved into itself or one of its children.',
            ),
          });
        const destinationRelativePath = path
          .relative(
            current.root,
            path.join(
              destinationParent.absolutePath,
              path.basename(current.absolutePath),
            ),
          )
          .split(path.sep)
          .join('/');
        const destination = await resolveWorkspacePath(
          store,
          parsed.workspaceId,
          destinationRelativePath,
          false,
        );
        if (!destination)
          throw new Error('Destination is outside the workspace.');
        try {
          await lstat(destination.absolutePath);
          return WorkspaceMutationResultEnvelopeSchema.parse({
            ok: false,
            error: error(
              'WRITE_FAILED',
              'A file or folder with that name already exists.',
            ),
          });
        } catch (cause) {
          if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause;
        }
        await moveWorkspaceEntry(
          current.absolutePath,
          destination.absolutePath,
        );
        return WorkspaceMutationResultEnvelopeSchema.parse({
          ok: true,
          value: {
            relativePath: destinationRelativePath,
            kind: currentStats.isDirectory() ? 'directory' : 'file',
          },
        });
      }
      if (operation === 'delete') {
        await deleteWorkspaceEntry(current.absolutePath);
        return WorkspaceMutationResultEnvelopeSchema.parse({
          ok: true,
          value: {
            relativePath,
            kind: currentStats.isDirectory() ? 'directory' : 'file',
          },
        });
      }
      const newName = parsed.newName ?? '';
      const parentPath = path.posix.dirname(relativePath).replace(/^\.$/, '');
      const destinationRelativePath = parentPath
        ? `${parentPath}/${newName}`
        : newName;
      const destination = await resolveWorkspacePath(
        store,
        parsed.workspaceId,
        destinationRelativePath,
        false,
      );
      if (!destination)
        throw new Error('Destination is outside the workspace.');
      try {
        await lstat(destination.absolutePath);
        return WorkspaceMutationResultEnvelopeSchema.parse({
          ok: false,
          error: error(
            'WRITE_FAILED',
            'A file or folder with that name already exists.',
          ),
        });
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause;
      }
      await renameWorkspaceEntry(
        current.absolutePath,
        destination.absolutePath,
      );
      return WorkspaceMutationResultEnvelopeSchema.parse({
        ok: true,
        value: {
          relativePath: destinationRelativePath,
          kind: currentStats.isDirectory() ? 'directory' : 'file',
        },
      });
    } catch (cause) {
      return WorkspaceMutationResultEnvelopeSchema.parse({
        ok: false,
        error: mapFsError(cause),
      });
    }
  };
  ipcMain.handle(IPC.WORKSPACE_CREATE_ENTRY, (event, request) =>
    workspaceMutation(event, request, 'create'),
  );
  ipcMain.handle(IPC.WORKSPACE_RENAME_ENTRY, (event, request) =>
    workspaceMutation(event, request, 'rename'),
  );
  ipcMain.handle(IPC.WORKSPACE_MOVE_ENTRY, (event, request) =>
    workspaceMutation(event, request, 'move'),
  );
  ipcMain.handle(IPC.WORKSPACE_DELETE_ENTRY, (event, request) =>
    workspaceMutation(event, request, 'delete'),
  );

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
      const expectedRevision = create
        ? undefined
        : (parsed as { expectedRevision?: string }).expectedRevision;
      if (expectedRevision) {
        const currentContent = await readFile(resolved.absolutePath, 'utf8');
        if (getDocumentRevision(currentContent) !== expectedRevision) {
          return WriteResultEnvelopeSchema.parse({
            ok: false,
            error: error(
              'WRITE_CONFLICT',
              'The document changed outside Dock. Reload it before saving.',
            ),
          });
        }
      }
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
  return () => {
    for (const watcher of watchers.values()) watcher.dispose();
    watchers.clear();
  };
};
