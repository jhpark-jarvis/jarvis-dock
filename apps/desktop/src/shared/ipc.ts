import { z } from 'zod';

export const IPC = {
  SYSTEM_HEALTH: 'system:health',
  SYSTEM_VERSION: 'system:version',
  WORKSPACE_CHOOSE: 'workspace:choose',
  WORKSPACE_LIST_MARKDOWN_FILES: 'workspace:list-markdown-files',
  DOCUMENT_READ: 'document:read',
  DOCUMENT_CREATE: 'document:create',
  DOCUMENT_WRITE: 'document:write',
  OPEN_LINK_SEARCH: 'browser:open-link-search',
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
      'EXTERNAL_OPEN_FAILED',
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
export const LinkBrowserSearchRequestSchema = z
  .object({ query: z.string().trim().min(1).max(200) })
  .strict();
export const LinkBrowserSearchResultSchema = z
  .object({ opened: z.literal(true) })
  .strict();
export const LinkBrowserSearchResultEnvelopeSchema = z.discriminatedUnion(
  'ok',
  [
    z
      .object({ ok: z.literal(true), value: LinkBrowserSearchResultSchema })
      .strict(),
    z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
  ],
);

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
export type LinkBrowserSearchResult = z.infer<
  typeof LinkBrowserSearchResultSchema
>;
export type LinkBrowserSearchResultEnvelope = z.infer<
  typeof LinkBrowserSearchResultEnvelopeSchema
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
  browser: {
    openLinkSearch: (request: {
      query: string;
    }) => Promise<LinkBrowserSearchResultEnvelope>;
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
