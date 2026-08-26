import type { IpcMain } from 'electron';
import {
  ImageAssetDeleteResultEnvelopeSchema,
  ImageAssetReadResultEnvelopeSchema,
  ImageAssetRequestSchema,
  ImageClipboardSaveRequestSchema,
  ImageDownloadResultEnvelopeSchema,
  IPC,
  type DockError,
} from '../shared/ipc';
import {
  deleteUnusedImageAsset,
  ImageAssetServiceError,
  readImageAssetFromWorkspace,
} from './image-asset-service';
import {
  ImageDownloadServiceError,
  saveImageBytesToWorkspace,
} from './image-download-service';
import {
  createWorkspaceStore,
  resolveWorkspacePath,
  type WorkspaceStore,
} from './workspace-service';

type HandlerRegistrar = Pick<IpcMain, 'handle'>;

export interface ImageAssetHandlerDependencies {
  ipcMain: HandlerRegistrar;
  isTrustedSender: (senderUrl: string) => boolean;
  store?: WorkspaceStore;
}

const error = (code: DockError['code'], message: string): DockError => ({
  code,
  message,
});

const mapAssetError = (cause: unknown): DockError => {
  if (cause instanceof ImageAssetServiceError) {
    if (cause.code === 'IMAGE_ASSET_IN_USE') {
      return error(
        'IMAGE_ASSET_IN_USE',
        'The image asset is still referenced by a Markdown document.',
      );
    }
    return error(cause.code, cause.message);
  }
  const fsCode = (cause as NodeJS.ErrnoException)?.code;
  if (fsCode === 'ENOENT')
    return error('NOT_FOUND', 'The requested image asset was not found.');
  if (fsCode === 'EACCES' || fsCode === 'EPERM')
    return error('PERMISSION_DENIED', 'Permission was denied.');
  return error('IMAGE_DOWNLOAD_FAILED', 'The image asset operation failed.');
};

const isTrusted = (
  event: { senderFrame: { url: string } },
  isTrustedSender: (senderUrl: string) => boolean,
): DockError | undefined =>
  isTrustedSender(event.senderFrame.url)
    ? undefined
    : error('UNAUTHORIZED_SENDER', 'The Dock request is not authorized.');

export const registerImageAssetHandlers = ({
  ipcMain,
  isTrustedSender,
  store = createWorkspaceStore(),
}: ImageAssetHandlerDependencies): void => {
  ipcMain.handle(IPC.IMAGE_READ_ASSET, async (event, request) => {
    const senderError = isTrusted(event, isTrustedSender);
    if (senderError)
      return ImageAssetReadResultEnvelopeSchema.parse({
        ok: false,
        error: senderError,
      });
    const parsed = ImageAssetRequestSchema.safeParse(request);
    if (!parsed.success)
      return ImageAssetReadResultEnvelopeSchema.parse({
        ok: false,
        error: error('INVALID_REQUEST', 'The Dock request is invalid.'),
      });
    try {
      const resolved = await resolveWorkspacePath(
        store,
        parsed.data.workspaceId,
        parsed.data.assetPath,
        true,
      );
      if (!resolved)
        return ImageAssetReadResultEnvelopeSchema.parse({
          ok: false,
          error: error(
            'WORKSPACE_NOT_SELECTED',
            'The asset path is not available.',
          ),
        });
      return ImageAssetReadResultEnvelopeSchema.parse({
        ok: true,
        value: await readImageAssetFromWorkspace({
          root: resolved.root,
          assetPath: parsed.data.assetPath,
        }),
      });
    } catch (cause) {
      return ImageAssetReadResultEnvelopeSchema.parse({
        ok: false,
        error: mapAssetError(cause),
      });
    }
  });

  ipcMain.handle(IPC.IMAGE_DELETE_ASSET, async (event, request) => {
    const senderError = isTrusted(event, isTrustedSender);
    if (senderError)
      return ImageAssetDeleteResultEnvelopeSchema.parse({
        ok: false,
        error: senderError,
      });
    const parsed = ImageAssetRequestSchema.safeParse(request);
    if (!parsed.success)
      return ImageAssetDeleteResultEnvelopeSchema.parse({
        ok: false,
        error: error('INVALID_REQUEST', 'The Dock request is invalid.'),
      });
    try {
      const resolved = await resolveWorkspacePath(
        store,
        parsed.data.workspaceId,
        parsed.data.assetPath,
        true,
      );
      if (!resolved)
        return ImageAssetDeleteResultEnvelopeSchema.parse({
          ok: false,
          error: error(
            'WORKSPACE_NOT_SELECTED',
            'The asset path is not available.',
          ),
        });
      return ImageAssetDeleteResultEnvelopeSchema.parse({
        ok: true,
        value: await deleteUnusedImageAsset({
          root: resolved.root,
          assetPath: parsed.data.assetPath,
        }),
      });
    } catch (cause) {
      return ImageAssetDeleteResultEnvelopeSchema.parse({
        ok: false,
        error: mapAssetError(cause),
      });
    }
  });

  ipcMain.handle(IPC.IMAGE_SAVE_CLIPBOARD, async (event, request) => {
    const senderError = isTrusted(event, isTrustedSender);
    if (senderError)
      return ImageDownloadResultEnvelopeSchema.parse({
        ok: false,
        error: senderError,
      });
    const parsed = ImageClipboardSaveRequestSchema.safeParse(request);
    if (!parsed.success)
      return ImageDownloadResultEnvelopeSchema.parse({
        ok: false,
        error: error('INVALID_REQUEST', 'The Dock request is invalid.'),
      });
    try {
      const resolved = await resolveWorkspacePath(
        store,
        parsed.data.workspaceId,
        parsed.data.relativePath,
        true,
      );
      if (!resolved)
        return ImageDownloadResultEnvelopeSchema.parse({
          ok: false,
          error: error(
            'WORKSPACE_NOT_SELECTED',
            'The document path is not available.',
          ),
        });
      return ImageDownloadResultEnvelopeSchema.parse({
        ok: true,
        value: await saveImageBytesToWorkspace({
          root: resolved.root,
          title: 'pasted-image',
          mimeType: parsed.data.mimeType,
          bytes: parsed.data.bytes,
        }),
      });
    } catch (cause) {
      const mapped =
        cause instanceof ImageDownloadServiceError
          ? error(cause.code, cause.message)
          : mapAssetError(cause);
      return ImageDownloadResultEnvelopeSchema.parse({
        ok: false,
        error: mapped,
      });
    }
  });
};
