import { describe, expect, it, vi } from 'vitest';
import {
  createGoogleSearchUrl,
  openLinkBrowserSearch,
} from './link-browser-search-service';

describe('link browser search service', () => {
  it('constructs a fixed HTTPS Google search URL with the query encoded', () => {
    const url = new URL(createGoogleSearchUrl('electron security & IPC'));

    expect(url.origin).toBe('https://www.google.com');
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('q')).toBe('electron security & IPC');
  });

  it('opens only the constructed search URL through the supplied boundary', async () => {
    const openExternal = vi.fn(async () => undefined);

    await openLinkBrowserSearch('electron', { openExternal });

    expect(openExternal).toHaveBeenCalledWith(
      'https://www.google.com/search?q=electron',
    );
  });
});
