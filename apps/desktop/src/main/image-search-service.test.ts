import { describe, expect, it } from 'vitest';
import { searchWikimediaImages } from './image-search-service';

const response = (
  body: unknown,
  status = 200,
  contentLength?: string,
): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => (name === 'content-length' ? contentLength : null),
    },
    text: async () => JSON.stringify(body),
  }) as Response;

describe('Wikimedia image search service', () => {
  it('requests Commons file results and keeps reusable metadata', async () => {
    const fetchImpl = async (input: URL, init?: RequestInit) => {
      expect(input.origin).toBe('https://commons.wikimedia.org');
      expect(input.pathname).toBe('/w/api.php');
      expect(input.searchParams.get('generator')).toBe('search');
      expect(input.searchParams.get('gsrsearch')).toBe('electron security');
      expect(input.searchParams.get('gsrnamespace')).toBe('6');
      expect(input.searchParams.get('iiprop')).toBe(
        'url|mime|size|extmetadata',
      );
      expect(init?.headers).toMatchObject({ Accept: 'application/json' });
      return response({
        query: {
          pages: [
            {
              pageid: 42,
              title: 'File:Electron security.png',
              fullurl:
                'https://commons.wikimedia.org/wiki/File:Electron_security.png',
              imageinfo: [
                {
                  url: 'https://upload.wikimedia.org/electron-security.png',
                  thumburl:
                    'https://upload.wikimedia.org/thumb/electron-security.png',
                  mime: 'image/png',
                  size: 1024,
                  extmetadata: {
                    LicenseShortName: { value: 'CC BY-SA 4.0' },
                    Artist: {
                      value: '<a href="https://example.com">Author</a>',
                    },
                    CommonsMetadataExtension: { value: 1.2 },
                  },
                },
              ],
            },
            {
              pageid: 43,
              title: 'File:Unsupported.svg',
              imageinfo: [
                {
                  url: 'https://upload.wikimedia.org/unsupported.svg',
                  mime: 'image/svg+xml',
                },
              ],
            },
          ],
        },
      });
    };

    await expect(
      searchWikimediaImages('electron security', { fetchImpl }),
    ).resolves.toEqual([
      {
        id: '42',
        title: 'Electron security.png',
        sourcePageUrl:
          'https://commons.wikimedia.org/wiki/File:Electron_security.png',
        thumbnailUrl:
          'https://upload.wikimedia.org/thumb/electron-security.png',
        downloadUrl: 'https://upload.wikimedia.org/electron-security.png',
        source: 'Wikimedia Commons',
        license: 'CC BY-SA 4.0 · 저작자: Author',
      },
    ]);
  });

  it('maps unavailable and malformed provider responses', async () => {
    await expect(
      searchWikimediaImages('query', {
        fetchImpl: async () => {
          throw new Error('network down');
        },
      }),
    ).rejects.toMatchObject({ code: 'IMAGE_SEARCH_UNAVAILABLE' });

    await expect(
      searchWikimediaImages('query', {
        fetchImpl: async () => response({ query: { pages: 'invalid' } }),
      }),
    ).rejects.toMatchObject({ code: 'IMAGE_SEARCH_FAILED' });
  });
});
