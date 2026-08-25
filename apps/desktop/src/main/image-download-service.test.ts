import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageSearchResult } from '../shared/ipc';
import { downloadImageToWorkspace } from './image-download-service';

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const image: ImageSearchResult = {
  id: 'image-1',
  title: 'Electron Process Model',
  sourcePageUrl: 'https://example.com/source',
  thumbnailUrl: 'https://images.example.test/thumb.png',
  downloadUrl: 'https://images.example.test/process.png',
  source: 'Example',
  license: 'Mock',
};

const makeResponse = (
  body: Uint8Array,
  status = 200,
  headers: Record<string, string> = {},
): Response =>
  new Response(body, {
    status,
    headers: {
      'content-length': String(body.byteLength),
      ...headers,
    },
  });

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => fs.rm(root, { recursive: true })),
  );
});

describe('image download service', () => {
  it('validates the host and MIME, then saves without overwriting', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-dock-image-'));
    roots.push(root);
    const realpath = vi.spyOn(fs, 'realpath');
    const fetchImpl = vi.fn(async (url: URL, init?: RequestInit) => {
      expect(url.toString()).toBe(image.downloadUrl);
      expect(init?.redirect).toBe('manual');
      return makeResponse(PNG, 200, { 'content-type': 'image/png' });
    });

    const first = await downloadImageToWorkspace(
      { root, image },
      { allowedHosts: new Set(['images.example.test']), fetchImpl },
    );
    const second = await downloadImageToWorkspace(
      { root, image },
      { allowedHosts: new Set(['images.example.test']), fetchImpl },
    );

    expect(first).toMatchObject({
      assetPath: 'assets/electron-process-model.png',
      mimeType: 'image/png',
      bytesWritten: PNG.byteLength,
    });
    expect(second.assetPath).toBe('assets/electron-process-model-2.png');
    expect(realpath).toHaveBeenCalledWith(root);
    await expect(
      fs.readFile(path.join(root, first.assetPath)),
    ).resolves.toEqual(PNG);
  });

  it('follows only allowed HTTPS redirects and rejects mismatched bytes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-dock-image-'));
    roots.push(root);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: '/final.png' },
        }),
      )
      .mockResolvedValueOnce(
        makeResponse(Buffer.from('not-png'), 200, {
          'content-type': 'image/png',
        }),
      );

    await expect(
      downloadImageToWorkspace(
        { root, image },
        { allowedHosts: new Set(['images.example.test']), fetchImpl },
      ),
    ).rejects.toMatchObject({ code: 'IMAGE_UNSUPPORTED' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects disallowed hosts and oversized responses', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-dock-image-'));
    roots.push(root);
    await expect(
      downloadImageToWorkspace(
        { root, image },
        { allowedHosts: new Set(['cdn.example.test']), fetchImpl: vi.fn() },
      ),
    ).rejects.toMatchObject({ code: 'IMAGE_UNSUPPORTED' });

    await expect(
      downloadImageToWorkspace(
        { root, image },
        {
          allowedHosts: new Set(['images.example.test']),
          fetchImpl: async () =>
            makeResponse(PNG, 200, {
              'content-type': 'image/png',
              'content-length': String(10 * 1024 * 1024 + 1),
            }),
        },
      ),
    ).rejects.toMatchObject({ code: 'IMAGE_TOO_LARGE' });
  });
});
