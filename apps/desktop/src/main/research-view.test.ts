import { describe, expect, it } from 'vitest';
import {
  createGoogleSearchUrl,
  createResearchWebPreferences,
  isAllowedResearchUrl,
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

  it('creates an isolated, sandboxed, non-persistent web preference set', () => {
    expect(createResearchWebPreferences()).toEqual({
      partition: 'dock-research',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    });
  });
});
