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

  it('keeps a current Naver page as a regular link', () => {
    expect(
      insertMarkdownLink(
        '# Start',
        {
          title: 'C 언어 - Hello World 출력하기 : 네이버 블로그',
          url: 'https://blog.naver.com/ghini7170/222144313413',
        },
        2,
        2,
      ),
    ).toBe(
      '# [C 언어 - Hello World 출력하기 : 네이버 블로그](https://blog.naver.com/ghini7170/222144313413)Start',
    );
  });
});
