import { shell, type IpcMain } from 'electron';
import {
  IPC,
  LinkBrowserSearchRequestSchema,
  LinkBrowserSearchResultEnvelopeSchema,
  type DockError,
} from '../shared/ipc';
import { openLinkBrowserSearch } from './link-browser-search-service';

type IpcMainHandlerRegistrar = Pick<IpcMain, 'handle'>;

export interface LinkBrowserSearchHandlerDependencies {
  ipcMain: IpcMainHandlerRegistrar;
  isTrustedSender: (senderUrl: string) => boolean;
  openLinkSearch?: (query: string) => Promise<void>;
}

const error = (code: DockError['code'], message: string): DockError => ({
  code,
  message,
});

export const registerLinkBrowserSearchHandlers = ({
  ipcMain,
  isTrustedSender,
  openLinkSearch,
}: LinkBrowserSearchHandlerDependencies): void => {
  ipcMain.handle(IPC.OPEN_LINK_SEARCH, async (event, request) => {
    if (!isTrustedSender(event.senderFrame.url)) {
      return LinkBrowserSearchResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'UNAUTHORIZED_SENDER',
          'The Dock request is not authorized.',
        ),
      });
    }

    const parsed = LinkBrowserSearchRequestSchema.safeParse(request);
    if (!parsed.success) {
      return LinkBrowserSearchResultEnvelopeSchema.parse({
        ok: false,
        error: error('INVALID_REQUEST', 'The Dock request is invalid.'),
      });
    }

    try {
      await (openLinkSearch?.(parsed.data.query) ??
        openLinkBrowserSearch(parsed.data.query, {
          openExternal: shell.openExternal,
        }));
      return LinkBrowserSearchResultEnvelopeSchema.parse({
        ok: true,
        value: { opened: true },
      });
    } catch {
      return LinkBrowserSearchResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'EXTERNAL_OPEN_FAILED',
          'The browser search could not be opened.',
        ),
      });
    }
  });
};
