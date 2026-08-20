import type { IpcMain } from 'electron';
import {
  ImageDownloadRequestSchema,
  ImageDownloadResultEnvelopeSchema,
  IPC,
  type DockError,
  type ImageDownloadResult,
} from '../shared/ipc';
import {
  downloadImageToWorkspace,
  ImageDownloadServiceError,
  type ImageDownloadServiceDependencies,
  type DownloadImageRequest,
} from './image-download-service';
import {
  createWorkspaceStore,
  resolveWorkspacePath,
  type WorkspaceStore,
} from './workspace-service';

type HandlerRegistrar = Pick<IpcMain, 'handle'>;
type ImageDownloader = (
  request: DownloadImageRequest,
  dependencies: ImageDownloadServiceDependencies,
) => Promise<ImageDownloadResult>;

export interface ImageDownloadHandlerDependencies {
  ipcMain: HandlerRegistrar;
  isTrustedSender: (senderUrl: string) => boolean;
  allowedHosts: ReadonlySet<string>;
  store?: WorkspaceStore;
  downloadImage?: ImageDownloader;
}

const error = (code: DockError['code'], message: string): DockError => ({
  code,
  message,
});

const mapDownloadError = (cause: unknown): DockError => {
  if (cause instanceof ImageDownloadServiceError) {
    return error(cause.code, cause.message);
  }
  const fsCode = (cause as NodeJS.ErrnoException)?.code;
  if (fsCode === 'ENOENT') {
    return error('NOT_FOUND', 'The requested file or folder was not found.');
  }
  if (fsCode === 'EACCES' || fsCode === 'EPERM') {
    return error('PERMISSION_DENIED', 'Permission was denied.');
  }
  return error(
    'IMAGE_DOWNLOAD_FAILED',
    'The image could not be downloaded or saved.',
  );
};

export const registerImageDownloadHandlers = ({
  ipcMain,
  isTrustedSender,
  allowedHosts,
  store = createWorkspaceStore(),
  downloadImage = downloadImageToWorkspace,
}: ImageDownloadHandlerDependencies): void => {
  ipcMain.handle(IPC.IMAGE_DOWNLOAD, async (event, request) => {
    if (!isTrustedSender(event.senderFrame.url)) {
      return ImageDownloadResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'UNAUTHORIZED_SENDER',
          'The Dock request is not authorized.',
        ),
      });
    }
    const parsed = ImageDownloadRequestSchema.safeParse(request);
    if (!parsed.success) {
      return ImageDownloadResultEnvelopeSchema.parse({
        ok: false,
        error: error('INVALID_REQUEST', 'The Dock request is invalid.'),
      });
    }
    if (!/\.(md|markdown)$/i.test(parsed.data.relativePath)) {
      return ImageDownloadResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'UNSUPPORTED_FILE',
          'Only Markdown documents are supported.',
        ),
      });
    }
    try {
      const resolved = await resolveWorkspacePath(
        store,
        parsed.data.workspaceId,
        parsed.data.relativePath,
        true,
      );
      if (!resolved) {
        return ImageDownloadResultEnvelopeSchema.parse({
          ok: false,
          error: error(
            store.has(parsed.data.workspaceId)
              ? 'PATH_OUTSIDE_WORKSPACE'
              : 'WORKSPACE_NOT_SELECTED',
            'The document path is not available.',
          ),
        });
      }
      const value = await downloadImage(
        { root: resolved.root, image: parsed.data.image },
        { allowedHosts },
      );
      return ImageDownloadResultEnvelopeSchema.parse({ ok: true, value });
    } catch (cause) {
      return ImageDownloadResultEnvelopeSchema.parse({
        ok: false,
        error: mapDownloadError(cause),
      });
    }
  });
};
