import { describe, expect, it } from 'vitest';
import {
  createGoogleSearchUrl,
  createResearchWebPreferences,
  isAllowedResearchUrl,
  normalizeResearchSearchResults,
} from './research-view';

describe('research view URL boundary', () => {
  it('constructs a fixed HTTPS Google search URL from the user query', () => {
    const url = new URL(createGoogleSearchUrl('electron security & IPC'));

    expect(url.origin).toBe('https://www.google.com');
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('q')).toBe('electron security & IPC');
  });

  it('allows only HTTP and HTTPS remote navigation', () => {
    expect(isAllowedResearchUrl('https://example.com/docs')).toBe(true);
    expect(isAllowedResearchUrl('http://example.com/docs')).toBe(true);
    expect(isAllowedResearchUrl('file:///secret.txt')).toBe(false);
    expect(isAllowedResearchUrl('javascript:alert(1)')).toBe(false);
  });

  it('creates an isolated, sandboxed, persistent web preference set', () => {
    expect(createResearchWebPreferences()).toEqual({
      partition: 'persist:dock-research',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    });
  });

  it('normalizes only bounded, unique HTTPS result links from the fixed extractor fixture', () => {
    const results = normalizeResearchSearchResults([
      {
        title: '  Electron   Security  ',
        href: 'https://www.electronjs.org/docs/latest/tutorial/security',
      },
      {
        title: 'Redirected result',
        href: 'https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fguide',
      },
      {
        title: 'Duplicate',
        href: 'https://www.electronjs.org/docs/latest/tutorial/security',
      },
      { title: 'Insecure', href: 'http://example.com/guide' },
      { title: '', href: 'https://example.com/empty-title' },
      { title: 'Broken', href: 'not a URL' },
    ]);

    expect(results).toEqual([
      {
        title: 'Electron Security',
        url: 'https://www.electronjs.org/docs/latest/tutorial/security',
      },
      { title: 'Redirected result', url: 'https://example.com/guide' },
    ]);
  });

  it('caps the extractor output before it crosses the IPC boundary', () => {
    const results = normalizeResearchSearchResults(
      Array.from({ length: 11 }, (_, index) => ({
        title: `Result ${index}`,
        href: `https://example.com/${index}`,
      })),
    );

    expect(results).toHaveLength(10);
  });
});
