import type { IpcMain } from 'electron';
import {
  IPC,
  ResearchCloseRequestSchema,
  ResearchCloseResultEnvelopeSchema,
  ResearchCurrentLinkRequestSchema,
  ResearchCurrentLinkResultEnvelopeSchema,
  ResearchOpenRequestSchema,
  ResearchOpenResultEnvelopeSchema,
  type DockError,
} from '../shared/ipc';
import type { ResearchCurrentLink } from './research-view';

type IpcMainHandlerRegistrar = Pick<IpcMain, 'handle'>;

export interface ResearchController {
  open: (query: string) => Promise<void>;
  close: () => void;
  currentLink: () => ResearchCurrentLink | undefined;
}

export interface ResearchHandlerDependencies {
  ipcMain: IpcMainHandlerRegistrar;
  getResearchController: () => ResearchController | undefined;
  isTrustedSender: (senderUrl: string) => boolean;
}

const error = (code: DockError['code'], message: string): DockError => ({
  code,
  message,
});

const senderError = (): DockError =>
  error('UNAUTHORIZED_SENDER', 'The Dock request is not authorized.');

const requestError = (): DockError =>
  error('INVALID_REQUEST', 'The Dock request is invalid.');

export const registerResearchHandlers = ({
  ipcMain,
  getResearchController,
  isTrustedSender,
}: ResearchHandlerDependencies): void => {
  ipcMain.handle(IPC.RESEARCH_OPEN, async (event, request) => {
    if (!isTrustedSender(event.senderFrame.url)) {
      return ResearchOpenResultEnvelopeSchema.parse({
        ok: false,
        error: senderError(),
      });
    }
    const parsed = ResearchOpenRequestSchema.safeParse(request);
    if (!parsed.success) {
      return ResearchOpenResultEnvelopeSchema.parse({
        ok: false,
        error: requestError(),
      });
    }
    const controller = getResearchController();
    if (!controller) {
      return ResearchOpenResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'RESEARCH_VIEW_FAILED',
          'The research view is unavailable.',
        ),
      });
    }
    try {
      await controller.open(parsed.data.query);
      return ResearchOpenResultEnvelopeSchema.parse({
        ok: true,
        value: { opened: true },
      });
    } catch {
      return ResearchOpenResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'RESEARCH_VIEW_FAILED',
          'The research view could not open.',
        ),
      });
    }
  });

  ipcMain.handle(IPC.RESEARCH_CLOSE, (event, request) => {
    if (!isTrustedSender(event.senderFrame.url)) {
      return ResearchCloseResultEnvelopeSchema.parse({
        ok: false,
        error: senderError(),
      });
    }
    if (!ResearchCloseRequestSchema.safeParse(request).success) {
      return ResearchCloseResultEnvelopeSchema.parse({
        ok: false,
        error: requestError(),
      });
    }
    getResearchController()?.close();
    return ResearchCloseResultEnvelopeSchema.parse({
      ok: true,
      value: { closed: true },
    });
  });

  ipcMain.handle(IPC.RESEARCH_CURRENT_LINK, (event, request) => {
    if (!isTrustedSender(event.senderFrame.url)) {
      return ResearchCurrentLinkResultEnvelopeSchema.parse({
        ok: false,
        error: senderError(),
      });
    }
    if (!ResearchCurrentLinkRequestSchema.safeParse(request).success) {
      return ResearchCurrentLinkResultEnvelopeSchema.parse({
        ok: false,
        error: requestError(),
      });
    }
    const controller = getResearchController();
    if (!controller) {
      return ResearchCurrentLinkResultEnvelopeSchema.parse({
        ok: false,
        error: error('RESEARCH_NOT_OPEN', 'The research view is not open.'),
      });
    }
    const link = controller.currentLink();
    if (!link) {
      return ResearchCurrentLinkResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'RESEARCH_INVALID_PAGE',
          'The current research page cannot be inserted.',
        ),
      });
    }
    return ResearchCurrentLinkResultEnvelopeSchema.parse({
      ok: true,
      value: link,
    });
  });
};
