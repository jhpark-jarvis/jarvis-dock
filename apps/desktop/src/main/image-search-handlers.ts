import type { IpcMain } from 'electron';
import {
  IPC,
  ImageSearchRequestSchema,
  ImageSearchResultEnvelopeSchema,
  type DockError,
} from '../shared/ipc';
import {
  ImageSearchServiceError,
  searchWikimediaImages,
} from './image-search-service';

type IpcMainHandlerRegistrar = Pick<IpcMain, 'handle'>;

export interface ImageSearchHandlerDependencies {
  ipcMain: IpcMainHandlerRegistrar;
  isTrustedSender: (senderUrl: string) => boolean;
  searchImages?: (query: string) => Promise<
    Array<{
      id: string;
      title: string;
      sourcePageUrl: string;
      thumbnailUrl: string;
      downloadUrl: string;
      source: string;
      license?: string;
    }>
  >;
}

const error = (code: DockError['code'], message: string): DockError => ({
  code,
  message,
});

const mapImageSearchError = (cause: unknown): DockError => {
  if (cause instanceof ImageSearchServiceError) {
    return error(cause.code, cause.message);
  }
  return error(
    'IMAGE_SEARCH_FAILED',
    'The image search could not be completed.',
  );
};

export const registerImageSearchHandlers = ({
  ipcMain,
  isTrustedSender,
  searchImages = searchWikimediaImages,
}: ImageSearchHandlerDependencies): void => {
  ipcMain.handle(IPC.SEARCH_IMAGES, async (event, request) => {
    if (!isTrustedSender(event.senderFrame.url)) {
      return ImageSearchResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'UNAUTHORIZED_SENDER',
          'The Dock request is not authorized.',
        ),
      });
    }

    const parsed = ImageSearchRequestSchema.safeParse(request);
    if (!parsed.success) {
      return ImageSearchResultEnvelopeSchema.parse({
        ok: false,
        error: error('INVALID_REQUEST', 'The Dock request is invalid.'),
      });
    }

    try {
      const results = await searchImages(parsed.data.query);
      return ImageSearchResultEnvelopeSchema.parse({
        ok: true,
        value: { results },
      });
    } catch (cause) {
      return ImageSearchResultEnvelopeSchema.parse({
        ok: false,
        error: mapImageSearchError(cause),
      });
    }
  });
};
