import { z } from 'zod';

export const IPC = {
  SYSTEM_HEALTH: 'system:health',
  SYSTEM_VERSION: 'system:version',
  WORKSPACE_CHOOSE: 'workspace:choose',
  WORKSPACE_LIST_MARKDOWN_FILES: 'workspace:list-markdown-files',
  DOCUMENT_READ: 'document:read',
  DOCUMENT_CREATE: 'document:create',
  DOCUMENT_WRITE: 'document:write',
  RESEARCH_OPEN: 'research:open',
  RESEARCH_CLOSE: 'research:close',
  RESEARCH_CURRENT_LINK: 'research:current-link',
  RESEARCH_INFO: 'research:info',
  RESEARCH_SELECT_TAB: 'research:select-tab',
  RESEARCH_RELOAD: 'research:reload',
  RESEARCH_STOP: 'research:stop',
  RESEARCH_CLOSE_TAB: 'research:close-tab',
  SEARCH_IMAGES: 'search:images',
  IMAGE_DOWNLOAD: 'image:download',
} as const;

export const EmptyRequestSchema = z.object({}).strict();

export const DockErrorSchema = z
  .object({
    code: z.enum([
      'CANCELLED',
      'INVALID_REQUEST',
      'UNAUTHORIZED_SENDER',
      'WORKSPACE_NOT_SELECTED',
      'PATH_OUTSIDE_WORKSPACE',
      'UNSUPPORTED_FILE',
      'NOT_FOUND',
      'PERMISSION_DENIED',
      'WRITE_FAILED',
      'SEARCH_FAILED',
      'SEARCH_RATE_LIMITED',
      'SEARCH_UNAVAILABLE',
      'RESEARCH_VIEW_FAILED',
      'RESEARCH_NOT_OPEN',
      'RESEARCH_INVALID_PAGE',
      'RESEARCH_TAB_NOT_FOUND',
      'IMAGE_SEARCH_FAILED',
      'IMAGE_SEARCH_UNAVAILABLE',
      'IMAGE_DOWNLOAD_FAILED',
      'IMAGE_TOO_LARGE',
      'IMAGE_UNSUPPORTED',
      'IMAGE_UNAVAILABLE',
      'INTERNAL',
    ]),
    message: z.string(),
  })
  .strict();

export const HealthResponseSchema = z
  .object({ status: z.literal('ok') })
  .strict();

export const VersionResponseSchema = z
  .object({ version: z.string().min(1) })
  .strict();

export const HealthResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: HealthResponseSchema }).strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);

export const VersionResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: VersionResponseSchema }).strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);

export const WorkspaceChooseRequestSchema = EmptyRequestSchema;
export const WorkspaceIdSchema = z.string().uuid();
export const RelativeMarkdownPathSchema = z
  .string()
  .min(1)
  .max(400)
  .refine((value) => !value.includes('\0'), 'null bytes are not allowed')
  .refine((value) => !/^[\\/]/.test(value), 'absolute paths are not allowed')
  .refine((value) => !/^[A-Za-z]:/.test(value), 'drive paths are not allowed')
  .refine(
    (value) => !value.split(/[\\/]/).includes('..'),
    'parent paths are not allowed',
  );

export const WorkspaceSummarySchema = z
  .object({ workspaceId: WorkspaceIdSchema, displayName: z.string().min(1) })
  .strict();
export const WorkspaceFileSchema = z
  .object({
    relativePath: RelativeMarkdownPathSchema,
    displayName: z.string().min(1),
  })
  .strict();
export const DocumentDataSchema = z
  .object({
    relativePath: RelativeMarkdownPathSchema,
    content: z.string(),
    encoding: z.literal('utf-8'),
  })
  .strict();
export const WriteResultSchema = z
  .object({
    relativePath: RelativeMarkdownPathSchema,
    bytesWritten: z.number().int().nonnegative(),
    savedAt: z.string().datetime(),
  })
  .strict();

export const WorkspaceChooseResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: WorkspaceSummarySchema }).strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);
export const WorkspaceFilesResultSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      value: z.object({ files: z.array(WorkspaceFileSchema) }).strict(),
    })
    .strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);
export const DocumentResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: DocumentDataSchema }).strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);
export const WriteResultEnvelopeSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: WriteResultSchema }).strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);

export const WorkspaceRequestSchema = z
  .object({ workspaceId: WorkspaceIdSchema })
  .strict();
export const DocumentRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    relativePath: RelativeMarkdownPathSchema,
  })
  .strict();
export const DocumentWriteRequestSchema = DocumentRequestSchema.extend({
  content: z.string().max(5_000_000),
}).strict();
export const ResearchOpenRequestSchema = z
  .object({ query: z.string().trim().min(1).max(200) })
  .strict();
export const ResearchSearchResultSchema = z
  .object({
    title: z.string().min(1).max(500),
    url: z
      .string()
      .url()
      .max(2048)
      .refine((value) => new URL(value).protocol === 'https:', {
        message: 'only HTTPS result URLs are allowed',
      }),
  })
  .strict();
export const ResearchOpenResultSchema = z
  .object({
    opened: z.literal(true),
    results: z.array(ResearchSearchResultSchema).max(10),
  })
  .strict();
export const ResearchOpenResultEnvelopeSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: ResearchOpenResultSchema }).strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);
export const ResearchCloseRequestSchema = EmptyRequestSchema;
export const ResearchCloseResultSchema = z
  .object({ closed: z.literal(true) })
  .strict();
export const ResearchCloseResultEnvelopeSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: ResearchCloseResultSchema }).strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);
export const ResearchCurrentLinkRequestSchema = EmptyRequestSchema;
export const ResearchCurrentLinkSchema = z
  .object({
    title: z.string().min(1).max(500),
    url: z.string().url().max(2048),
  })
  .strict();
export const ResearchCurrentLinkResultEnvelopeSchema = z.discriminatedUnion(
  'ok',
  [
    z
      .object({ ok: z.literal(true), value: ResearchCurrentLinkSchema })
      .strict(),
    z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
  ],
);
export const ResearchTabInfoSchema = z
  .object({
    id: z.string().min(1).max(50),
    title: z.string().max(500),
    url: z.string().max(2048),
    loading: z.boolean(),
  })
  .strict();
export const ResearchInfoSchema = z
  .object({
    activeTabId: z.string().min(1).max(50).nullable(),
    tabs: z.array(ResearchTabInfoSchema).max(6),
  })
  .strict();
export const ResearchInfoResultEnvelopeSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: ResearchInfoSchema }).strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);
export const ResearchTabRequestSchema = z
  .object({ tabId: z.string().min(1).max(50) })
  .strict();
export const ResearchActionRequestSchema = EmptyRequestSchema;
export const ResearchActionResultSchema = z
  .object({ updated: z.literal(true) })
  .strict();
export const ResearchActionResultEnvelopeSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: ResearchActionResultSchema }).strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);

export const ImageSearchResultSchema = z
  .object({
    id: z.string().min(1).max(200),
    title: z.string().min(1).max(500),
    sourcePageUrl: z.string().url().max(2048),
    thumbnailUrl: z.string().url().max(2048),
    downloadUrl: z.string().url().max(2048),
    source: z.string().min(1).max(200),
    license: z.string().max(200).optional(),
  })
  .strict();
export const ImageSearchRequestSchema = z
  .object({ query: z.string().trim().min(1).max(200) })
  .strict();
export const ImageSearchResultEnvelopeSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      value: z.object({ results: z.array(ImageSearchResultSchema) }).strict(),
    })
    .strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);
export const ImageDownloadRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    relativePath: RelativeMarkdownPathSchema,
    image: ImageSearchResultSchema,
  })
  .strict();
export const ImageDownloadResultSchema = z
  .object({
    assetPath: RelativeMarkdownPathSchema,
    bytesWritten: z.number().int().positive(),
    mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  })
  .strict();
export const ImageDownloadResultEnvelopeSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: ImageDownloadResultSchema }).strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);

export type DockError = z.infer<typeof DockErrorSchema>;
export type HealthResult = z.infer<typeof HealthResultSchema>;
export type VersionResult = z.infer<typeof VersionResultSchema>;
export type WorkspaceSummary = z.infer<typeof WorkspaceSummarySchema>;
export type WorkspaceFile = z.infer<typeof WorkspaceFileSchema>;
export type DocumentData = z.infer<typeof DocumentDataSchema>;
export type WriteResult = z.infer<typeof WriteResultSchema>;
export type WorkspaceChooseResult = z.infer<typeof WorkspaceChooseResultSchema>;
export type WorkspaceFilesResult = z.infer<typeof WorkspaceFilesResultSchema>;
export type DocumentResult = z.infer<typeof DocumentResultSchema>;
export type WriteResultEnvelope = z.infer<typeof WriteResultEnvelopeSchema>;
export type ResearchOpenResult = z.infer<typeof ResearchOpenResultSchema>;
export type ResearchSearchResult = z.infer<typeof ResearchSearchResultSchema>;
export type ResearchOpenResultEnvelope = z.infer<
  typeof ResearchOpenResultEnvelopeSchema
>;
export type ResearchCloseResultEnvelope = z.infer<
  typeof ResearchCloseResultEnvelopeSchema
>;
export type ResearchCurrentLink = z.infer<typeof ResearchCurrentLinkSchema>;
export type ResearchCurrentLinkResultEnvelope = z.infer<
  typeof ResearchCurrentLinkResultEnvelopeSchema
>;
export type ResearchTabInfo = z.infer<typeof ResearchTabInfoSchema>;
export type ResearchInfoResultEnvelope = z.infer<
  typeof ResearchInfoResultEnvelopeSchema
>;
export type ResearchActionResultEnvelope = z.infer<
  typeof ResearchActionResultEnvelopeSchema
>;
export type ImageSearchResult = z.infer<typeof ImageSearchResultSchema>;
export type ImageSearchResultEnvelope = z.infer<
  typeof ImageSearchResultEnvelopeSchema
>;
export type ImageDownloadRequest = z.infer<typeof ImageDownloadRequestSchema>;
export type ImageDownloadResult = z.infer<typeof ImageDownloadResultSchema>;
export type ImageDownloadResultEnvelope = z.infer<
  typeof ImageDownloadResultEnvelopeSchema
>;

export interface DockApi {
  system: {
    health: () => Promise<HealthResult>;
    version: () => Promise<VersionResult>;
  };
  workspace: {
    choose: () => Promise<WorkspaceChooseResult>;
    listMarkdownFiles: (request: {
      workspaceId: string;
    }) => Promise<WorkspaceFilesResult>;
  };
  document: {
    read: (request: {
      workspaceId: string;
      relativePath: string;
    }) => Promise<DocumentResult>;
    create: (request: {
      workspaceId: string;
      relativePath: string;
    }) => Promise<WriteResultEnvelope>;
    write: (request: {
      workspaceId: string;
      relativePath: string;
      content: string;
    }) => Promise<WriteResultEnvelope>;
  };
  research: {
    open: (request: { query: string }) => Promise<ResearchOpenResultEnvelope>;
    close: () => Promise<ResearchCloseResultEnvelope>;
    currentLink: () => Promise<ResearchCurrentLinkResultEnvelope>;
    info: () => Promise<ResearchInfoResultEnvelope>;
    selectTab: (request: {
      tabId: string;
    }) => Promise<ResearchActionResultEnvelope>;
    reload: () => Promise<ResearchActionResultEnvelope>;
    stop: () => Promise<ResearchActionResultEnvelope>;
    closeTab: (request: {
      tabId: string;
    }) => Promise<ResearchActionResultEnvelope>;
  };
  image: {
    search: (request: { query: string }) => Promise<ImageSearchResultEnvelope>;
    download: (
      request: ImageDownloadRequest,
    ) => Promise<ImageDownloadResultEnvelope>;
  };
}

export const internalError = (): DockError => ({
  code: 'INTERNAL',
  message: 'The Dock system request could not be completed.',
});
