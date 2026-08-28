import { describe, expect, it } from 'vitest';
import {
  EmptyRequestSchema,
  HealthResultSchema,
  ImageSearchRequestSchema,
  ImageSearchResultEnvelopeSchema,
  ImageDownloadRequestSchema,
  ImageDownloadResultEnvelopeSchema,
  ImageAssetListResultEnvelopeSchema,
  ResearchOpenResultEnvelopeSchema,
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

  it('validates image search queries and provider metadata', () => {
    expect(
      ImageSearchRequestSchema.safeParse({ query: 'electron' }).success,
    ).toBe(true);
    expect(ImageSearchRequestSchema.safeParse({ query: '' }).success).toBe(
      false,
    );
    expect(
      ImageSearchResultEnvelopeSchema.safeParse({
        ok: true,
        value: {
          results: [
            {
              id: '42',
              title: 'Electron security.png',
              sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Electron',
              thumbnailUrl: 'https://upload.wikimedia.org/thumb.png',
              downloadUrl: 'https://upload.wikimedia.org/image.png',
              source: 'Wikimedia Commons',
              license: 'CC BY-SA 4.0',
            },
          ],
        },
      }).success,
    ).toBe(true);
  });

  it('accepts only bounded workspace image asset listings', () => {
    expect(
      ImageAssetListResultEnvelopeSchema.safeParse({
        ok: true,
        value: {
          assets: [
            { assetPath: 'assets/diagram.png', displayName: 'diagram.png' },
          ],
        },
      }).success,
    ).toBe(true);
    expect(
      ImageAssetListResultEnvelopeSchema.safeParse({
        ok: true,
        value: {
          assets: [{ assetPath: '../diagram.png', displayName: 'diagram.png' }],
        },
      }).success,
    ).toBe(false);
  });

  it('allows only bounded HTTPS link cards in a Research View response', () => {
    expect(
      ResearchOpenResultEnvelopeSchema.safeParse({
        ok: true,
        value: {
          opened: true,
          results: [
            {
              title: 'Electron Security',
              url: 'https://www.electronjs.org/docs/latest/tutorial/security',
            },
          ],
        },
      }).success,
    ).toBe(true);
    expect(
      ResearchOpenResultEnvelopeSchema.safeParse({
        ok: true,
        value: {
          opened: true,
          results: [{ title: 'Insecure', url: 'http://example.com' }],
        },
      }).success,
    ).toBe(false);
  });
});
