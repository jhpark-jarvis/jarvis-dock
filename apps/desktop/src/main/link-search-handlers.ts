import type { IpcMain } from 'electron';
import {
  IPC,
  LinkSearchRequestSchema,
  LinkSearchResultEnvelopeSchema,
  type DockError,
} from '../shared/ipc';
import {
  LinkSearchServiceError,
  searchBraveLinks,
} from './link-search-service';

type IpcMainHandlerRegistrar = Pick<IpcMain, 'handle'>;

export interface LinkSearchHandlerDependencies {
  ipcMain: IpcMainHandlerRegistrar;
  isTrustedSender: (senderUrl: string) => boolean;
  searchLinks?: (
    query: string,
    apiKey: string,
  ) => Promise<Array<{ title: string; url: string; source: string }>>;
}

const error = (code: DockError['code'], message: string): DockError => ({
  code,
  message,
});

const mapSearchError = (cause: unknown): DockError => {
  if (cause instanceof LinkSearchServiceError) {
    return error(cause.code, cause.message);
  }
  return error('SEARCH_FAILED', 'The link search could not be completed.');
};

export const registerLinkSearchHandlers = ({
  ipcMain,
  isTrustedSender,
  searchLinks = searchBraveLinks,
}: LinkSearchHandlerDependencies): void => {
  ipcMain.handle(IPC.SEARCH_LINKS, async (event, request) => {
    if (!isTrustedSender(event.senderFrame.url)) {
      return LinkSearchResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'UNAUTHORIZED_SENDER',
          'The Dock request is not authorized.',
        ),
      });
    }

    const parsed = LinkSearchRequestSchema.safeParse(request);
    if (!parsed.success) {
      return LinkSearchResultEnvelopeSchema.parse({
        ok: false,
        error: error('INVALID_REQUEST', 'The Dock request is invalid.'),
      });
    }

    try {
      const results = await searchLinks(parsed.data.query, parsed.data.apiKey);
      return LinkSearchResultEnvelopeSchema.parse({
        ok: true,
        value: { results },
      });
    } catch (cause) {
      return LinkSearchResultEnvelopeSchema.parse({
        ok: false,
        error: mapSearchError(cause),
      });
    }
  });
};
