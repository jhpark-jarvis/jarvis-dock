import { z } from 'zod';

export const IPC = {
  SYSTEM_HEALTH: 'system:health',
  SYSTEM_VERSION: 'system:version',
} as const;

export const EmptyRequestSchema = z.object({}).strict();

export const DockErrorSchema = z
  .object({
    code: z.enum(['INVALID_REQUEST', 'UNAUTHORIZED_SENDER', 'INTERNAL']),
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

export type DockError = z.infer<typeof DockErrorSchema>;
export type HealthResult = z.infer<typeof HealthResultSchema>;
export type VersionResult = z.infer<typeof VersionResultSchema>;

export interface DockApi {
  system: {
    health: () => Promise<HealthResult>;
    version: () => Promise<VersionResult>;
  };
}

export const internalError = (): DockError => ({
  code: 'INTERNAL',
  message: 'The Dock system request could not be completed.',
});
