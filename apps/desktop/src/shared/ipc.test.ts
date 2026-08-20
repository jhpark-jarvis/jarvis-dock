import { describe, expect, it } from 'vitest';
import {
  EmptyRequestSchema,
  HealthResultSchema,
  ImageDownloadRequestSchema,
  ImageDownloadResultEnvelopeSchema,
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

  it('validates image download requests and result contracts', () => {
    const request = {
      workspaceId: '11111111-1111-4111-8111-111111111111',
      relativePath: 'guide.md',
      image: {
        id: 'image-1',
        title: 'Diagram',
        sourcePageUrl: 'https://example.com/source',
        thumbnailUrl: 'https://images.example.test/thumb.png',
        downloadUrl: 'https://images.example.test/diagram.png',
        source: 'Example',
      },
    };
    expect(ImageDownloadRequestSchema.safeParse(request).success).toBe(true);
    expect(
      ImageDownloadResultEnvelopeSchema.safeParse({
        ok: true,
        value: {
          assetPath: 'assets/diagram.png',
          bytesWritten: 8,
          mimeType: 'image/png',
        },
      }).success,
    ).toBe(true);
    expect(
      ImageDownloadResultEnvelopeSchema.safeParse({
        ok: true,
        value: {
          assetPath: '../diagram.png',
          bytesWritten: 8,
          mimeType: 'image/png',
        },
      }).success,
    ).toBe(false);
  });
});
