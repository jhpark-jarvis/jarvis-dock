import {
  HealthResultSchema,
  internalError,
  IPC,
  type DockApi,
  type HealthResult,
  VersionResultSchema,
  type VersionResult,
  DocumentRequestSchema,
  DocumentResultSchema,
  DocumentWriteRequestSchema,
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
  ImageDownloadRequestSchema,
  ImageDownloadResultEnvelopeSchema,
  ImageAssetRequestSchema,
  ImageAssetListResultEnvelopeSchema,
  ImageAssetReadResultEnvelopeSchema,
  ImageAssetDeleteResultEnvelopeSchema,
  ImageClipboardSaveRequestSchema,
  ImageSearchRequestSchema,
  ImageSearchResultEnvelopeSchema,
  WorkspaceChooseResultSchema,
  WorkspaceOpenFolderRequestSchema,
  WorkspaceOpenFolderResultEnvelopeSchema,
  WorkspaceFilesResultSchema,
  WorkspaceRequestSchema,
  WriteResultEnvelopeSchema,
  ArchitectureCreateProjectRequestSchema,
  ArchitectureCreateProjectResultEnvelopeSchema,
  type DocumentResult,
  type WorkspaceChooseResult,
  type WorkspaceOpenFolderResultEnvelope,
  type WorkspaceFilesResult,
  type WriteResultEnvelope,
  type ResearchCloseResultEnvelope,
  type ResearchCurrentLinkResultEnvelope,
  type ResearchInfoResultEnvelope,
  type ResearchActionResultEnvelope,
  type ResearchOpenResultEnvelope,
  type ImageDownloadResultEnvelope,
  type ImageAssetReadResultEnvelope,
  type ImageAssetListResultEnvelope,
  type ImageAssetDeleteResultEnvelope,
  type ImageSearchResultEnvelope,
  type ArchitectureCreateProjectResultEnvelope,
} from '../shared/ipc';

export interface IpcInvoker {
  invoke: (channel: string, request: unknown) => Promise<unknown>;
}

const invokeHealth = async (ipcRenderer: IpcInvoker): Promise<HealthResult> => {
  const result = HealthResultSchema.safeParse(
    await ipcRenderer.invoke(IPC.SYSTEM_HEALTH, {}),
  );

  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeVersion = async (
  ipcRenderer: IpcInvoker,
): Promise<VersionResult> => {
  const result = VersionResultSchema.safeParse(
    await ipcRenderer.invoke(IPC.SYSTEM_VERSION, {}),
  );

  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeWorkspaceChoose = async (
  ipcRenderer: IpcInvoker,
): Promise<WorkspaceChooseResult> => {
  const result = WorkspaceChooseResultSchema.safeParse(
    await ipcRenderer.invoke(IPC.WORKSPACE_CHOOSE, {}),
  );
  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeWorkspaceFiles = async (
  ipcRenderer: IpcInvoker,
  request: unknown,
): Promise<WorkspaceFilesResult> => {
  const parsed = WorkspaceRequestSchema.safeParse(request);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'The Dock request is invalid.',
      },
    };
  const result = WorkspaceFilesResultSchema.safeParse(
    await ipcRenderer.invoke(IPC.WORKSPACE_LIST_MARKDOWN_FILES, parsed.data),
  );
  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeWorkspaceOpenFolder = async (
  ipcRenderer: IpcInvoker,
  request: unknown,
): Promise<WorkspaceOpenFolderResultEnvelope> => {
  const parsed = WorkspaceOpenFolderRequestSchema.safeParse(request);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'The Dock request is invalid.',
      },
    };
  const result = WorkspaceOpenFolderResultEnvelopeSchema.safeParse(
    await ipcRenderer.invoke(IPC.WORKSPACE_OPEN_FOLDER, parsed.data),
  );
  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeDocumentRead = async (
  ipcRenderer: IpcInvoker,
  request: unknown,
): Promise<DocumentResult> => {
  const parsed = DocumentRequestSchema.safeParse(request);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'The Dock request is invalid.',
      },
    };
  const result = DocumentResultSchema.safeParse(
    await ipcRenderer.invoke(IPC.DOCUMENT_READ, parsed.data),
  );
  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeDocumentWrite = async (
  ipcRenderer: IpcInvoker,
  channel: string,
  request: unknown,
): Promise<WriteResultEnvelope> => {
  const parsed = DocumentWriteRequestSchema.safeParse(request);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'The Dock request is invalid.',
      },
    };
  const result = WriteResultEnvelopeSchema.safeParse(
    await ipcRenderer.invoke(channel, parsed.data),
  );
  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeArchitectureCreateProject = async (
  ipcRenderer: IpcInvoker,
  request: unknown,
): Promise<ArchitectureCreateProjectResultEnvelope> => {
  const parsed = ArchitectureCreateProjectRequestSchema.safeParse(request);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'The Dock request is invalid.',
      },
    };
  const result = ArchitectureCreateProjectResultEnvelopeSchema.safeParse(
    await ipcRenderer.invoke(IPC.ARCHITECTURE_CREATE_PROJECT, parsed.data),
  );
  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeResearchOpen = async (
  ipcRenderer: IpcInvoker,
  request: unknown,
): Promise<ResearchOpenResultEnvelope> => {
  const parsed = ResearchOpenRequestSchema.safeParse(request);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'The Dock request is invalid.',
      },
    };
  const result = ResearchOpenResultEnvelopeSchema.safeParse(
    await ipcRenderer.invoke(IPC.RESEARCH_OPEN, parsed.data),
  );
  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeResearchClose = async (
  ipcRenderer: IpcInvoker,
): Promise<ResearchCloseResultEnvelope> => {
  const result = ResearchCloseResultEnvelopeSchema.safeParse(
    await ipcRenderer.invoke(
      IPC.RESEARCH_CLOSE,
      ResearchCloseRequestSchema.parse({}),
    ),
  );
  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeResearchCurrentLink = async (
  ipcRenderer: IpcInvoker,
): Promise<ResearchCurrentLinkResultEnvelope> => {
  const result = ResearchCurrentLinkResultEnvelopeSchema.safeParse(
    await ipcRenderer.invoke(
      IPC.RESEARCH_CURRENT_LINK,
      ResearchCurrentLinkRequestSchema.parse({}),
    ),
  );
  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeResearchInfo = async (
  ipcRenderer: IpcInvoker,
): Promise<ResearchInfoResultEnvelope> => {
  const result = ResearchInfoResultEnvelopeSchema.safeParse(
    await ipcRenderer.invoke(
      IPC.RESEARCH_INFO,
      ResearchActionRequestSchema.parse({}),
    ),
  );
  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeResearchTabAction = async (
  ipcRenderer: IpcInvoker,
  channel: string,
  request: unknown,
): Promise<ResearchActionResultEnvelope> => {
  const parsed =
    channel === IPC.RESEARCH_SELECT_TAB || channel === IPC.RESEARCH_CLOSE_TAB
      ? ResearchTabRequestSchema.safeParse(request)
      : channel === IPC.RESEARCH_SET_VISIBLE
        ? ResearchVisibilityRequestSchema.safeParse(request)
        : ResearchActionRequestSchema.safeParse(request);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'The Dock request is invalid.',
      },
    };
  const result = ResearchActionResultEnvelopeSchema.safeParse(
    await ipcRenderer.invoke(channel, parsed.data),
  );
  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeImageDownload = async (
  ipcRenderer: IpcInvoker,
  request: unknown,
): Promise<ImageDownloadResultEnvelope> => {
  const parsed = ImageDownloadRequestSchema.safeParse(request);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'The Dock request is invalid.',
      },
    };
  const result = ImageDownloadResultEnvelopeSchema.safeParse(
    await ipcRenderer.invoke(IPC.IMAGE_DOWNLOAD, parsed.data),
  );
  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeImageSearch = async (
  ipcRenderer: IpcInvoker,
  request: unknown,
): Promise<ImageSearchResultEnvelope> => {
  const parsed = ImageSearchRequestSchema.safeParse(request);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'The Dock request is invalid.',
      },
    };
  const result = ImageSearchResultEnvelopeSchema.safeParse(
    await ipcRenderer.invoke(IPC.SEARCH_IMAGES, parsed.data),
  );
  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeImageAssetRead = async (
  ipcRenderer: IpcInvoker,
  request: unknown,
): Promise<ImageAssetReadResultEnvelope> => {
  const parsed = ImageAssetRequestSchema.safeParse(request);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'The Dock request is invalid.',
      },
    };
  const result = ImageAssetReadResultEnvelopeSchema.safeParse(
    await ipcRenderer.invoke(IPC.IMAGE_READ_ASSET, parsed.data),
  );
  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeImageAssetList = async (
  ipcRenderer: IpcInvoker,
  request: unknown,
): Promise<ImageAssetListResultEnvelope> => {
  const parsed = WorkspaceRequestSchema.safeParse(request);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'The Dock request is invalid.',
      },
    };
  const result = ImageAssetListResultEnvelopeSchema.safeParse(
    await ipcRenderer.invoke(IPC.IMAGE_LIST_ASSETS, parsed.data),
  );
  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeImageAssetDelete = async (
  ipcRenderer: IpcInvoker,
  request: unknown,
): Promise<ImageAssetDeleteResultEnvelope> => {
  const parsed = ImageAssetRequestSchema.safeParse(request);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'The Dock request is invalid.',
      },
    };
  const result = ImageAssetDeleteResultEnvelopeSchema.safeParse(
    await ipcRenderer.invoke(IPC.IMAGE_DELETE_ASSET, parsed.data),
  );
  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeImageClipboardSave = async (
  ipcRenderer: IpcInvoker,
  request: unknown,
): Promise<ImageDownloadResultEnvelope> => {
  const parsed = ImageClipboardSaveRequestSchema.safeParse(request);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'The Dock request is invalid.',
      },
    };
  const result = ImageDownloadResultEnvelopeSchema.safeParse(
    await ipcRenderer.invoke(IPC.IMAGE_SAVE_CLIPBOARD, parsed.data),
  );
  return result.success ? result.data : { ok: false, error: internalError() };
};

export const createDockApi = (ipcRenderer: IpcInvoker): DockApi => ({
  system: {
    health: () => invokeHealth(ipcRenderer),
    version: () => invokeVersion(ipcRenderer),
  },
  workspace: {
    choose: () => invokeWorkspaceChoose(ipcRenderer),
    listMarkdownFiles: (request) => invokeWorkspaceFiles(ipcRenderer, request),
    openFolder: (request) => invokeWorkspaceOpenFolder(ipcRenderer, request),
  },
  document: {
    read: (request) => invokeDocumentRead(ipcRenderer, request),
    create: async (request) => {
      const parsed = DocumentRequestSchema.safeParse(request);
      if (!parsed.success)
        return {
          ok: false,
          error: {
            code: 'INVALID_REQUEST' as const,
            message: 'The Dock request is invalid.',
          },
        };
      const result = WriteResultEnvelopeSchema.safeParse(
        await ipcRenderer.invoke(IPC.DOCUMENT_CREATE, parsed.data),
      );
      return result.success
        ? result.data
        : { ok: false, error: internalError() };
    },
    write: (request) =>
      invokeDocumentWrite(ipcRenderer, IPC.DOCUMENT_WRITE, request),
  },
  architecture: {
    createProject: (request) =>
      invokeArchitectureCreateProject(ipcRenderer, request),
  },
  research: {
    open: (request) => invokeResearchOpen(ipcRenderer, request),
    close: () => invokeResearchClose(ipcRenderer),
    currentLink: () => invokeResearchCurrentLink(ipcRenderer),
    info: () => invokeResearchInfo(ipcRenderer),
    selectTab: (request) =>
      invokeResearchTabAction(ipcRenderer, IPC.RESEARCH_SELECT_TAB, request),
    reload: () => invokeResearchTabAction(ipcRenderer, IPC.RESEARCH_RELOAD, {}),
    stop: () => invokeResearchTabAction(ipcRenderer, IPC.RESEARCH_STOP, {}),
    closeTab: (request) =>
      invokeResearchTabAction(ipcRenderer, IPC.RESEARCH_CLOSE_TAB, request),
    setVisible: (request) =>
      invokeResearchTabAction(ipcRenderer, IPC.RESEARCH_SET_VISIBLE, request),
  },
  image: {
    search: (request) => invokeImageSearch(ipcRenderer, request),
    download: (request) => invokeImageDownload(ipcRenderer, request),
    list: (request) => invokeImageAssetList(ipcRenderer, request),
    read: (request) => invokeImageAssetRead(ipcRenderer, request),
    delete: (request) => invokeImageAssetDelete(ipcRenderer, request),
    saveClipboard: (request) => invokeImageClipboardSave(ipcRenderer, request),
  },
});
