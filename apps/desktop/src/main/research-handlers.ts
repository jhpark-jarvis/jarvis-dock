import type { IpcMain } from 'electron';
import {
  IPC,
  ResearchCloseRequestSchema,
  ResearchCloseResultEnvelopeSchema,
  ResearchCurrentLinkRequestSchema,
  ResearchCurrentLinkResultEnvelopeSchema,
  ResearchInfoResultEnvelopeSchema,
  ResearchActionRequestSchema,
  ResearchActionResultEnvelopeSchema,
  ResearchOpenRequestSchema,
  ResearchOpenResultEnvelopeSchema,
  ResearchTabRequestSchema,
  ResearchVisibilityRequestSchema,
  type DockError,
  type ResearchSearchResult,
} from '../shared/ipc';
import type { ResearchCurrentLink, ResearchInfo } from './research-view';

type IpcMainHandlerRegistrar = Pick<IpcMain, 'handle'>;

export interface ResearchController {
  open: (query: string) => Promise<ResearchSearchResult[]>;
  close: () => void;
  currentLink: () => ResearchCurrentLink | undefined;
  info: () => ResearchInfo;
  selectTab: (tabId: string) => boolean;
  reload: () => boolean;
  stop: () => boolean;
  closeTab: (tabId: string) => boolean;
  setVisible: (visible: boolean) => boolean;
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
      const results = await controller.open(parsed.data.query);
      return ResearchOpenResultEnvelopeSchema.parse({
        ok: true,
        value: { opened: true, results },
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

  ipcMain.handle(IPC.RESEARCH_INFO, (event, request) => {
    if (!isTrustedSender(event.senderFrame.url)) {
      return ResearchInfoResultEnvelopeSchema.parse({
        ok: false,
        error: senderError(),
      });
    }
    if (!ResearchActionRequestSchema.safeParse(request).success) {
      return ResearchInfoResultEnvelopeSchema.parse({
        ok: false,
        error: requestError(),
      });
    }
    const controller = getResearchController();
    if (!controller) {
      return ResearchInfoResultEnvelopeSchema.parse({
        ok: false,
        error: error('RESEARCH_NOT_OPEN', 'The research view is not open.'),
      });
    }
    return ResearchInfoResultEnvelopeSchema.parse({
      ok: true,
      value: controller.info(),
    });
  });

  ipcMain.handle(IPC.RESEARCH_SELECT_TAB, (event, request) => {
    if (!isTrustedSender(event.senderFrame.url)) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: senderError(),
      });
    }
    const parsed = ResearchTabRequestSchema.safeParse(request);
    if (!parsed.success) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: requestError(),
      });
    }
    const controller = getResearchController();
    if (!controller) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: error('RESEARCH_NOT_OPEN', 'The research view is not open.'),
      });
    }
    if (!controller.selectTab(parsed.data.tabId)) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'RESEARCH_TAB_NOT_FOUND',
          'The research tab was not found.',
        ),
      });
    }
    return ResearchActionResultEnvelopeSchema.parse({
      ok: true,
      value: { updated: true },
    });
  });

  ipcMain.handle(IPC.RESEARCH_RELOAD, (event, request) => {
    if (!isTrustedSender(event.senderFrame.url)) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: senderError(),
      });
    }
    if (!ResearchActionRequestSchema.safeParse(request).success) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: requestError(),
      });
    }
    const controller = getResearchController();
    if (!controller) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: error('RESEARCH_NOT_OPEN', 'The research view is not open.'),
      });
    }
    if (!controller.reload()) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: error('RESEARCH_NOT_OPEN', 'The research view is not open.'),
      });
    }
    return ResearchActionResultEnvelopeSchema.parse({
      ok: true,
      value: { updated: true },
    });
  });

  ipcMain.handle(IPC.RESEARCH_STOP, (event, request) => {
    if (!isTrustedSender(event.senderFrame.url)) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: senderError(),
      });
    }
    if (!ResearchActionRequestSchema.safeParse(request).success) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: requestError(),
      });
    }
    const controller = getResearchController();
    if (!controller || !controller.stop()) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: error('RESEARCH_NOT_OPEN', 'The research view is not open.'),
      });
    }
    return ResearchActionResultEnvelopeSchema.parse({
      ok: true,
      value: { updated: true },
    });
  });

  ipcMain.handle(IPC.RESEARCH_SET_VISIBLE, (event, request) => {
    if (!isTrustedSender(event.senderFrame.url)) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: senderError(),
      });
    }
    const parsed = ResearchVisibilityRequestSchema.safeParse(request);
    if (!parsed.success) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: requestError(),
      });
    }
    const controller = getResearchController();
    if (!controller) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: error('RESEARCH_NOT_OPEN', 'The research view is not open.'),
      });
    }
    if (!controller.setVisible(parsed.data.visible)) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: error('RESEARCH_NOT_OPEN', 'The research view is not open.'),
      });
    }
    return ResearchActionResultEnvelopeSchema.parse({
      ok: true,
      value: { updated: true },
    });
  });

  ipcMain.handle(IPC.RESEARCH_CLOSE_TAB, (event, request) => {
    if (!isTrustedSender(event.senderFrame.url)) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: senderError(),
      });
    }
    const parsed = ResearchTabRequestSchema.safeParse(request);
    if (!parsed.success) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: requestError(),
      });
    }
    const controller = getResearchController();
    if (!controller || !controller.closeTab(parsed.data.tabId)) {
      return ResearchActionResultEnvelopeSchema.parse({
        ok: false,
        error: error(
          'RESEARCH_TAB_NOT_FOUND',
          'The research tab was not found.',
        ),
      });
    }
    return ResearchActionResultEnvelopeSchema.parse({
      ok: true,
      value: { updated: true },
    });
  });
};
