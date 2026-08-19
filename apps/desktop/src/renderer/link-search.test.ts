import { describe, expect, it } from 'vitest';
import {
  createMockLinkProvider,
  formatMarkdownLink,
  insertMarkdownLink,
  isAllowedLinkUrl,
} from './link-search';

describe('link search flow', () => {
  it('returns deterministic mock results and distinguishes empty and error states', async () => {
    const provider = createMockLinkProvider();

    await expect(provider.search('electron')).resolves.toHaveLength(2);
    await expect(provider.search('empty')).resolves.toEqual([]);
    await expect(provider.search('error')).rejects.toThrow(
      'The mock provider failed.',
    );
  });

  it('allows only http and https URLs', () => {
    expect(isAllowedLinkUrl('https://example.com/docs')).toBe(true);
    expect(isAllowedLinkUrl('http://example.com/docs')).toBe(true);
    expect(isAllowedLinkUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedLinkUrl('file:///secret.txt')).toBe(false);
  });

  it('escapes Markdown link syntax and inserts at the selected range', () => {
    const result = {
      title: 'A [safe] title',
      url: 'https://example.com/a_(b)',
      source: 'Example',
    };

    expect(formatMarkdownLink(result)).toBe(
      '[A \\[safe\\] title](https://example.com/a_\\(b\\))',
    );
    expect(insertMarkdownLink('before after', result, 7, 12)).toBe(
      'before [A \\[safe\\] title](https://example.com/a_\\(b\\))',
    );
  });

  it('rejects unsafe provider results before insertion', () => {
    expect(() =>
      formatMarkdownLink({
        title: 'Run',
        url: 'javascript:alert(1)',
        source: 'unsafe',
      }),
    ).toThrow('Only http and https URLs are allowed.');
  });
});
