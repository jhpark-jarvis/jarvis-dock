import { describe, expect, it } from 'vitest';
import {
  EmptyRequestSchema,
  HealthResultSchema,
  VersionResultSchema,
} from './ipc';

describe('IPC contract schemas', () => {
  it('accepts an empty bootstrap request only', () => {
    expect(EmptyRequestSchema.safeParse({}).success).toBe(true);
    expect(EmptyRequestSchema.safeParse({ extra: true }).success).toBe(false);
    expect(EmptyRequestSchema.safeParse(null).success).toBe(false);
  });

  it('accepts only documented health and version responses', () => {
    expect(
      HealthResultSchema.safeParse({
        ok: true,
        value: { status: 'ok' },
      }).success,
    ).toBe(true);
    expect(
      VersionResultSchema.safeParse({
        ok: true,
        value: { version: '1.0.0' },
      }).success,
    ).toBe(true);
    expect(
      VersionResultSchema.safeParse({
        ok: true,
        value: { version: '' },
      }).success,
    ).toBe(false);
  });
});
