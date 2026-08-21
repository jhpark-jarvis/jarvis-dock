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
  ResearchOpenRequestSchema,
  ResearchOpenResultEnvelopeSchema,
  ImageDownloadRequestSchema,
  ImageDownloadResultEnvelopeSchema,
  ImageSearchRequestSchema,
  ImageSearchResultEnvelopeSchema,
  WorkspaceChooseResultSchema,
  WorkspaceFilesResultSchema,
  WorkspaceRequestSchema,
  WriteResultEnvelopeSchema,
  type DocumentResult,
  type WorkspaceChooseResult,
  type WorkspaceFilesResult,
  type WriteResultEnvelope,
  type ResearchCloseResultEnvelope,
  type ResearchCurrentLinkResultEnvelope,
  type ResearchOpenResultEnvelope,
  type ImageDownloadResultEnvelope,
  type ImageSearchResultEnvelope,
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

export const createDockApi = (ipcRenderer: IpcInvoker): DockApi => ({
  system: {
    health: () => invokeHealth(ipcRenderer),
    version: () => invokeVersion(ipcRenderer),
  },
  workspace: {
    choose: () => invokeWorkspaceChoose(ipcRenderer),
    listMarkdownFiles: (request) => invokeWorkspaceFiles(ipcRenderer, request),
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
  research: {
    open: (request) => invokeResearchOpen(ipcRenderer, request),
    close: () => invokeResearchClose(ipcRenderer),
    currentLink: () => invokeResearchCurrentLink(ipcRenderer),
  },
  image: {
    search: (request) => invokeImageSearch(ipcRenderer, request),
    download: (request) => invokeImageDownload(ipcRenderer, request),
  },
});
