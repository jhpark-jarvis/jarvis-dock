import { describe, expect, it, vi } from 'vitest';
import { searchBraveLinks } from './link-search-service';

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

describe('Brave link search service', () => {
  it('sends only the bounded query and maps safe web results', async () => {
    const fetchImpl = vi.fn(async (input: URL, init?: RequestInit) => {
      expect(input.origin).toBe('https://api.search.brave.com');
      expect(input.pathname).toBe('/res/v1/web/search');
      expect(input.searchParams.get('q')).toBe('electron security');
      expect(input.searchParams.get('count')).toBe('10');
      expect(init?.headers).toEqual({
        Accept: 'application/json',
        'X-Subscription-Token': 'user-key',
      });
      return response({
        web: {
          results: [
            {
              title: 'Electron Security',
              url: 'https://www.electronjs.org/docs/latest/tutorial/security',
              profile: { name: 'Electron documentation' },
            },
            {
              title: 'Unsafe',
              url: 'javascript:alert(1)',
            },
          ],
        },
      });
    });

    await expect(
      searchBraveLinks('electron security', 'user-key', { fetchImpl }),
    ).resolves.toEqual([
      {
        title: 'Electron Security',
        url: 'https://www.electronjs.org/docs/latest/tutorial/security',
        source: 'Electron documentation',
      },
    ]);
  });

  it('maps rate limits and unavailable providers to safe errors', async () => {
    await expect(
      searchBraveLinks('query', 'key', {
        fetchImpl: async () => response({}, 429),
      }),
    ).rejects.toMatchObject({
      code: 'SEARCH_RATE_LIMITED',
    });

    await expect(
      searchBraveLinks('query', 'key', {
        fetchImpl: async () => {
          throw new Error('network down');
        },
      }),
    ).rejects.toMatchObject({
      code: 'SEARCH_UNAVAILABLE',
    });
  });

  it('rejects oversized responses before parsing them', async () => {
    await expect(
      searchBraveLinks('query', 'key', {
        fetchImpl: async () => response({}, 200, '1000001'),
      }),
    ).rejects.toMatchObject({
      code: 'SEARCH_FAILED',
    });
  });
});
