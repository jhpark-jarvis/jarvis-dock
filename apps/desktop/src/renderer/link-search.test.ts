import { describe, expect, it } from 'vitest';
import {
  formatMarkdownLink,
  insertMarkdownLink,
  isAllowedLinkUrl,
} from './link-search';

describe('link insertion flow', () => {
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
      }),
    ).toThrow('Only http and https URLs are allowed.');
  });
});
