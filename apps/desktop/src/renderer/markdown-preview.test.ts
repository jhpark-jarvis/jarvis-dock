// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { renderMarkdownPreview } from './markdown-preview';

describe('renderMarkdownPreview', () => {
  it('renders basic markdown and strips raw HTML', () => {
    const html = renderMarkdownPreview(
      '# Title\n\n**safe**\n\n<script>alert(1)</script>',
    );
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>safe</strong>');
    expect(html).not.toContain('<script');
  });

  it('turns workspace markdown links into Dock document links', () => {
    const html = renderMarkdownPreview('[Design](./design.md)');
    expect(html).toContain('data-dock-document="./design.md"');
    expect(html).toContain('href="#"');
  });

  it('does not allow file or javascript links', () => {
    const html = renderMarkdownPreview(
      '[secret](file:///C:/secret.txt) [run](javascript:alert(1))',
    );
    expect(html).not.toContain('file:///');
    expect(html).not.toContain('javascript:');
  });
});
