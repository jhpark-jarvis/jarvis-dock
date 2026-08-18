import { z } from 'zod';

export const IPC = {
  SYSTEM_HEALTH: 'system:health',
  SYSTEM_VERSION: 'system:version',
  WORKSPACE_CHOOSE: 'workspace:choose',
  WORKSPACE_LIST_MARKDOWN_FILES: 'workspace:list-markdown-files',
  DOCUMENT_READ: 'document:read',
  DOCUMENT_CREATE: 'document:create',
  DOCUMENT_WRITE: 'document:write',
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
}

export const internalError = (): DockError => ({
  code: 'INTERNAL',
  message: 'The Dock system request could not be completed.',
});
