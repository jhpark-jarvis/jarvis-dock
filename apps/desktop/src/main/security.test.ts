import { describe, expect, it } from 'vitest';
import { isTrustedRendererUrl } from './security';

describe('isTrustedRendererUrl', () => {
  it('accepts only the configured development renderer URL', () => {
    expect(
      isTrustedRendererUrl('http://localhost:5173/', 'http://localhost:5173'),
    ).toBe(true);
    expect(
      isTrustedRendererUrl(
        'http://localhost:5173/settings',
        'http://localhost:5173',
      ),
    ).toBe(false);
    expect(
      isTrustedRendererUrl('https://example.com/', 'http://localhost:5173'),
    ).toBe(false);
  });

  it('does not trust arbitrary file URLs', () => {
    expect(
      isTrustedRendererUrl(
        'file:///app/renderer/main_window/index.html',
        'file:///app/renderer/main_window/index.html',
      ),
    ).toBe(true);
    expect(
      isTrustedRendererUrl(
        'file:///tmp/untrusted.html',
        'file:///app/renderer/main_window/index.html',
      ),
    ).toBe(false);
  });
});
