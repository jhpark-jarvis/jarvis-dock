import { describe, expect, it } from 'vitest';
import {
  isAllowedRendererNavigation,
  isTrustedRendererUrl,
  PRODUCTION_CONTENT_SECURITY_POLICY,
  withContentSecurityPolicy,
} from './security';

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

  it('allows navigation only to the configured renderer URL', () => {
    expect(
      isAllowedRendererNavigation(
        'file:///app/renderer/main_window/index.html',
        'file:///app/renderer/main_window/index.html',
      ),
    ).toBe(true);
    expect(
      isAllowedRendererNavigation(
        'https://example.com/',
        'file:///app/renderer/main_window/index.html',
      ),
    ).toBe(false);
  });

  it('sets one restrictive Content-Security-Policy header', () => {
    const headers = withContentSecurityPolicy({
      'content-security-policy': ['default-src *'],
      'Content-Type': ['text/html'],
    });

    expect(headers).toEqual({
      'Content-Type': ['text/html'],
      'Content-Security-Policy': [PRODUCTION_CONTENT_SECURITY_POLICY],
    });
    expect(PRODUCTION_CONTENT_SECURITY_POLICY).not.toContain('unsafe-eval');
    expect(PRODUCTION_CONTENT_SECURITY_POLICY).not.toContain('unsafe-inline');
  });
});
