import { z } from 'zod';

export const IPC = {
  SYSTEM_HEALTH: 'system:health',
  SYSTEM_VERSION: 'system:version',
  WORKSPACE_CHOOSE: 'workspace:choose',
  WORKSPACE_OPEN_FOLDER: 'workspace:open-folder',
  WORKSPACE_LIST_MARKDOWN_FILES: 'workspace:list-markdown-files',
  WORKSPACE_LIST_ENTRIES: 'workspace:list-entries',
  WORKSPACE_CREATE_ENTRY: 'workspace:create-entry',
  WORKSPACE_RENAME_ENTRY: 'workspace:rename-entry',
  WORKSPACE_MOVE_ENTRY: 'workspace:move-entry',
  WORKSPACE_DELETE_ENTRY: 'workspace:delete-entry',
  WORKSPACE_CHANGED: 'workspace:changed',
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
  RESEARCH_SET_VISIBLE: 'research:set-visible',
  SEARCH_IMAGES: 'search:images',
  IMAGE_DOWNLOAD: 'image:download',
  IMAGE_LIST_ASSETS: 'image:list-assets',
  IMAGE_READ_ASSET: 'image:read-asset',
  IMAGE_DELETE_ASSET: 'image:delete-asset',
  IMAGE_SAVE_CLIPBOARD: 'image:save-clipboard',
  ARCHITECTURE_CREATE_PROJECT: 'architecture:create-project',
  ARCHITECTURE_CHECK_PROJECT: 'architecture:check-project',
  ARCHITECTURE_CREATE_ADR: 'architecture:create-adr',
} as const;

export const EmptyRequestSchema = z.object({}).strict();

export const DockErrorSchema = z
  .object({
    code: z.enum([
      'CANCELLED',
      'INVALID_REQUEST',
      'UNAUTHORIZED_SENDER',
      'WORKSPACE_NOT_SELECTED',
      'INVALID_NAME',
      'DIRECTORY_NOT_FOUND',
      'DIRECTORY_NOT_EMPTY',
      'FOLDER_OPEN_FAILED',
      'PATH_OUTSIDE_WORKSPACE',
      'UNSUPPORTED_FILE',
      'NOT_FOUND',
      'WRITE_CONFLICT',
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
      'IMAGE_ASSET_IN_USE',
      'IMAGE_TOO_LARGE',
      'IMAGE_UNSUPPORTED',
      'IMAGE_UNAVAILABLE',
      'ARCHITECTURE_CONFLICT',
      'ARCHITECTURE_CREATE_FAILED',
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
export const WorkspaceOpenFolderRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    folder: z.enum(['document', 'assets']),
  })
  .strict();
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
const WorkspaceRelativePathSchema = z
  .string()
  .max(400)
  .refine((value) => !value.includes('\0'), 'null bytes are not allowed')
  .refine((value) => !/^[\\/]/.test(value), 'absolute paths are not allowed')
  .refine((value) => !/^[A-Za-z]:/.test(value), 'drive paths are not allowed')
  .refine(
    (value) => !value.split(/[\\/]/).includes('..'),
    'parent paths are not allowed',
  );
export const WorkspaceEntryNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((value) => !value.includes('\0'), 'null bytes are not allowed')
  .refine((value) => !/[\\/]/.test(value), 'a name must be one path segment')
  .refine((value) => value !== '.' && value !== '..', 'invalid name')
  .refine((value) => !value.startsWith('.'), 'hidden names are not allowed');
export const WorkspaceEntrySchema = z
  .object({
    relativePath: RelativeMarkdownPathSchema,
    displayName: z.string().min(1),
    kind: z.enum(['file', 'directory']),
  })
  .strict();
export const DocumentDataSchema = z
  .object({
    relativePath: RelativeMarkdownPathSchema,
    content: z.string(),
    encoding: z.literal('utf-8'),
    revision: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const DocumentRevisionSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const WriteResultSchema = z
  .object({
    relativePath: RelativeMarkdownPathSchema,
    bytesWritten: z.number().int().nonnegative(),
    savedAt: z.string().datetime(),
    revision: DocumentRevisionSchema,
  })
  .strict();

export const WorkspaceChooseResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: WorkspaceSummarySchema }).strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);
export const WorkspaceOpenFolderResultSchema = z
  .object({ opened: z.literal(true) })
  .strict();
export const WorkspaceOpenFolderResultEnvelopeSchema = z.discriminatedUnion(
  'ok',
  [
    z
      .object({ ok: z.literal(true), value: WorkspaceOpenFolderResultSchema })
      .strict(),
    z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
  ],
);
export const WorkspaceFilesResultSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      value: z.object({ files: z.array(WorkspaceFileSchema) }).strict(),
    })
    .strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);
export const WorkspaceEntriesResultSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      value: z.object({ entries: z.array(WorkspaceEntrySchema) }).strict(),
    })
    .strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);
export const WorkspaceCreateEntryRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    parentPath: WorkspaceRelativePathSchema.default(''),
    name: WorkspaceEntryNameSchema,
    kind: z.enum(['file', 'directory']),
  })
  .strict();
export const WorkspaceRenameEntryRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    relativePath: RelativeMarkdownPathSchema,
    newName: WorkspaceEntryNameSchema,
  })
  .strict();
export const WorkspaceMoveEntryRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    relativePath: WorkspaceRelativePathSchema.min(1),
    destinationParentPath: WorkspaceRelativePathSchema.default(''),
  })
  .strict();
export const WorkspaceDeleteEntryRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    relativePath: RelativeMarkdownPathSchema,
  })
  .strict();
export const WorkspaceMutationResultSchema = z
  .object({
    relativePath: RelativeMarkdownPathSchema,
    kind: z.enum(['file', 'directory']),
  })
  .strict();
export const WorkspaceMutationResultEnvelopeSchema = z.discriminatedUnion(
  'ok',
  [
    z
      .object({ ok: z.literal(true), value: WorkspaceMutationResultSchema })
      .strict(),
    z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
  ],
);
export const WorkspaceChangedEventSchema = z
  .object({ workspaceId: WorkspaceIdSchema })
  .strict();
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
  expectedRevision: DocumentRevisionSchema.optional(),
}).strict();
const hasUnsafeControlCharacter = (value: string): boolean =>
  [...value].some((character) => {
    const code = character.charCodeAt(0);
    return (
      (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127
    );
  });
const ArchitectureTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(1_000)
  .refine(
    (value) => !hasUnsafeControlCharacter(value),
    'control characters are not allowed',
  );
const ArchitectureOptionalTextSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => !hasUnsafeControlCharacter(value),
    'control characters are not allowed',
  );
export const ArchitectureCreateProjectRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    projectName: ArchitectureTextSchema.max(120),
    purpose: ArchitectureTextSchema.max(1_000),
    techStack: ArchitectureOptionalTextSchema.optional().default(''),
  })
  .strict();
export const ArchitectureDocumentResultSchema = z
  .object({
    relativePath: RelativeMarkdownPathSchema,
    bytesWritten: z.number().int().positive(),
  })
  .strict();
export const ArchitectureCreateProjectResultSchema = z
  .object({
    projectName: z.string().min(1).max(120),
    files: z.array(ArchitectureDocumentResultSchema).length(6),
  })
  .strict();
export const ArchitectureCreateProjectResultEnvelopeSchema =
  z.discriminatedUnion('ok', [
    z
      .object({
        ok: z.literal(true),
        value: ArchitectureCreateProjectResultSchema,
      })
      .strict(),
    z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
  ]);
export const ArchitectureCheckProjectRequestSchema = z
  .object({ workspaceId: WorkspaceIdSchema })
  .strict();
export const ArchitectureCheckFileSchema = z
  .object({
    relativePath: RelativeMarkdownPathSchema,
    status: z.enum(['present', 'missing', 'invalid']),
    issues: z.array(z.string().min(1).max(300)).max(10),
  })
  .strict();
export const ArchitectureCheckProjectResultSchema = z
  .object({
    passed: z.boolean(),
    files: z.array(ArchitectureCheckFileSchema).length(6),
  })
  .strict();
export const ArchitectureCheckProjectResultEnvelopeSchema =
  z.discriminatedUnion('ok', [
    z
      .object({
        ok: z.literal(true),
        value: ArchitectureCheckProjectResultSchema,
      })
      .strict(),
    z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
  ]);
export const ArchitectureAdrStatusSchema = z.enum([
  'Proposed',
  'Accepted',
  'Rejected',
  'Superseded',
]);
const ArchitectureAdrTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(5_000)
  .refine(
    (value) => !hasUnsafeControlCharacter(value),
    'control characters are not allowed',
  );
export const ArchitectureCreateAdrRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    title: ArchitectureAdrTextSchema.max(200),
    status: ArchitectureAdrStatusSchema,
    context: ArchitectureAdrTextSchema,
    decision: ArchitectureAdrTextSchema,
    consequences: ArchitectureAdrTextSchema,
  })
  .strict();
export const ArchitectureCreateAdrResultSchema = z
  .object({
    relativePath: RelativeMarkdownPathSchema,
    adrNumber: z.number().int().positive().max(9999),
    title: z.string().min(1).max(200),
    status: ArchitectureAdrStatusSchema,
    indexUpdated: z.literal(true),
  })
  .strict();
export const ArchitectureCreateAdrResultEnvelopeSchema = z.discriminatedUnion(
  'ok',
  [
    z
      .object({
        ok: z.literal(true),
        value: ArchitectureCreateAdrResultSchema,
      })
      .strict(),
    z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
  ],
);
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
    results: z.array(ResearchSearchResultSchema).max(10),
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
export const ResearchVisibilityRequestSchema = z
  .object({ visible: z.boolean() })
  .strict();
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
export const ImageAssetRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    assetPath: RelativeMarkdownPathSchema,
  })
  .strict();
export const ImageAssetItemSchema = z
  .object({
    assetPath: RelativeMarkdownPathSchema,
    displayName: z.string().min(1),
  })
  .strict();
export const ImageAssetListResultSchema = z
  .object({ assets: z.array(ImageAssetItemSchema).max(200) })
  .strict();
export const ImageAssetListResultEnvelopeSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: ImageAssetListResultSchema }).strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);
export const ImageAssetReadResultSchema = z
  .object({
    assetPath: RelativeMarkdownPathSchema,
    dataUrl: z.string().max(15_000_000),
    mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  })
  .strict();
export const ImageAssetReadResultEnvelopeSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: ImageAssetReadResultSchema }).strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);
export const ImageAssetDeleteResultSchema = z
  .object({
    assetPath: RelativeMarkdownPathSchema,
    deleted: z.boolean(),
  })
  .strict();
export const ImageAssetDeleteResultEnvelopeSchema = z.discriminatedUnion('ok', [
  z
    .object({ ok: z.literal(true), value: ImageAssetDeleteResultSchema })
    .strict(),
  z.object({ ok: z.literal(false), error: DockErrorSchema }).strict(),
]);
export const ImageClipboardSaveRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    relativePath: RelativeMarkdownPathSchema,
    mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    bytes: z
      .instanceof(Uint8Array)
      .refine(
        (value) => value.byteLength > 0 && value.byteLength <= 10 * 1024 * 1024,
      ),
  })
  .strict();

export type DockError = z.infer<typeof DockErrorSchema>;
export type HealthResult = z.infer<typeof HealthResultSchema>;
export type VersionResult = z.infer<typeof VersionResultSchema>;
export type WorkspaceSummary = z.infer<typeof WorkspaceSummarySchema>;
export type WorkspaceFile = z.infer<typeof WorkspaceFileSchema>;
export type WorkspaceEntry = z.infer<typeof WorkspaceEntrySchema>;
export type DocumentData = z.infer<typeof DocumentDataSchema>;
export type WriteResult = z.infer<typeof WriteResultSchema>;
export type WorkspaceChooseResult = z.infer<typeof WorkspaceChooseResultSchema>;
export type WorkspaceOpenFolderResultEnvelope = z.infer<
  typeof WorkspaceOpenFolderResultEnvelopeSchema
>;
export type WorkspaceFilesResult = z.infer<typeof WorkspaceFilesResultSchema>;
export type WorkspaceEntriesResult = z.infer<
  typeof WorkspaceEntriesResultSchema
>;
export type WorkspaceMutationResultEnvelope = z.infer<
  typeof WorkspaceMutationResultEnvelopeSchema
>;
export type WorkspaceChangedEvent = z.infer<typeof WorkspaceChangedEventSchema>;
export type DocumentResult = z.infer<typeof DocumentResultSchema>;
export type WriteResultEnvelope = z.infer<typeof WriteResultEnvelopeSchema>;
export type ArchitectureCreateProjectRequest = z.infer<
  typeof ArchitectureCreateProjectRequestSchema
>;
export type ArchitectureCreateProjectResultEnvelope = z.infer<
  typeof ArchitectureCreateProjectResultEnvelopeSchema
>;
export type ArchitectureCheckProjectResultEnvelope = z.infer<
  typeof ArchitectureCheckProjectResultEnvelopeSchema
>;
export type ArchitectureCreateAdrRequest = z.infer<
  typeof ArchitectureCreateAdrRequestSchema
>;
export type ArchitectureCreateAdrResultEnvelope = z.infer<
  typeof ArchitectureCreateAdrResultEnvelopeSchema
>;
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
export type ImageAssetRequest = z.infer<typeof ImageAssetRequestSchema>;
export type ImageAssetItem = z.infer<typeof ImageAssetItemSchema>;
export type ImageAssetListResultEnvelope = z.infer<
  typeof ImageAssetListResultEnvelopeSchema
>;
export type ImageAssetReadResult = z.infer<typeof ImageAssetReadResultSchema>;
export type ImageAssetReadResultEnvelope = z.infer<
  typeof ImageAssetReadResultEnvelopeSchema
>;
export type ImageAssetDeleteResult = z.infer<
  typeof ImageAssetDeleteResultSchema
>;
export type ImageAssetDeleteResultEnvelope = z.infer<
  typeof ImageAssetDeleteResultEnvelopeSchema
>;
export type ImageClipboardSaveRequest = z.infer<
  typeof ImageClipboardSaveRequestSchema
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
    listEntries?: (request: {
      workspaceId: string;
    }) => Promise<WorkspaceEntriesResult>;
    createEntry?: (request: {
      workspaceId: string;
      parentPath?: string;
      name: string;
      kind: 'file' | 'directory';
    }) => Promise<WorkspaceMutationResultEnvelope>;
    renameEntry?: (request: {
      workspaceId: string;
      relativePath: string;
      newName: string;
    }) => Promise<WorkspaceMutationResultEnvelope>;
    moveEntry?: (request: {
      workspaceId: string;
      relativePath: string;
      destinationParentPath?: string;
    }) => Promise<WorkspaceMutationResultEnvelope>;
    deleteEntry?: (request: {
      workspaceId: string;
      relativePath: string;
    }) => Promise<WorkspaceMutationResultEnvelope>;
    onChanged?: (
      listener: (event: WorkspaceChangedEvent) => void,
    ) => () => void;
    openFolder: (request: {
      workspaceId: string;
      folder: 'document' | 'assets';
    }) => Promise<WorkspaceOpenFolderResultEnvelope>;
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
  architecture: {
    createProject: (
      request: ArchitectureCreateProjectRequest,
    ) => Promise<ArchitectureCreateProjectResultEnvelope>;
    checkProject: (request: {
      workspaceId: string;
    }) => Promise<ArchitectureCheckProjectResultEnvelope>;
    createAdr: (
      request: ArchitectureCreateAdrRequest,
    ) => Promise<ArchitectureCreateAdrResultEnvelope>;
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
    setVisible: (request: {
      visible: boolean;
    }) => Promise<ResearchActionResultEnvelope>;
  };
  image: {
    search: (request: { query: string }) => Promise<ImageSearchResultEnvelope>;
    download: (
      request: ImageDownloadRequest,
    ) => Promise<ImageDownloadResultEnvelope>;
    list: (request: {
      workspaceId: string;
    }) => Promise<ImageAssetListResultEnvelope>;
    read: (request: ImageAssetRequest) => Promise<ImageAssetReadResultEnvelope>;
    delete: (
      request: ImageAssetRequest,
    ) => Promise<ImageAssetDeleteResultEnvelope>;
    saveClipboard: (
      request: ImageClipboardSaveRequest,
    ) => Promise<ImageDownloadResultEnvelope>;
  };
}

export const internalError = (): DockError => ({
  code: 'INTERNAL',
  message: 'The Dock system request could not be completed.',
});
