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

  it('renders only resolved workspace images as data-backed image elements', () => {
    const html = renderMarkdownPreview(
      '![safe](./assets/safe.png) ![remote](https://example.com/remote.png)',
      {
        documentPath: 'guide.md',
        imageSources: {
          'assets/safe.png': 'data:image/png;base64,AA==',
        },
      },
    );

    expect(html).toContain('<img src="data:image/png;base64,AA==" alt="safe">');
    expect(html).not.toContain('remote');
  });

  it('highlights supported fenced code without rendering code as HTML', () => {
    const html = renderMarkdownPreview(
      '```ts\nconst answer = "safe"; // note\n```',
    );

    expect(html).toContain('language-ts');
    expect(html).toContain('code-token--keyword');
    expect(html).toContain('code-token--string');
    expect(html).toContain('code-token--comment');
    expect(html).toContain('"safe"');
  });

  it('escapes unsupported fenced code languages', () => {
    const html = renderMarkdownPreview('```unknown\n<div>safe</div>\n```');

    expect(html).toContain('&lt;div&gt;safe&lt;/div&gt;');
    expect(html).not.toContain('<div>safe</div>');
  });

  it('renders GitHub-flavored Markdown tables after sanitizing preview HTML', () => {
    const html = renderMarkdownPreview(
      '| 이름 | 역할 | 상태 |\n| --- | :---: | ---: |\n| Dock | Editor | 준비 |\n| Research | Preview | 완료 |',
    );

    expect(html).toContain('<table>');
    expect(html).toContain('<thead>');
    expect(html).toContain('<tbody>');
    expect(html).toContain('<th>이름</th>');
    expect(html).toContain('<td>Dock</td>');
    expect(html).toContain('align="center"');
    expect(html).toContain('align="right"');
  });

  it('preserves GitHub-flavored task list checkboxes as disabled controls', () => {
    const html = renderMarkdownPreview(
      '- [ ] 문서 작성\n- [x] QA 완료\n\n- [not-a-checkbox] 일반 항목',
    );

    expect(html).toMatch(
      /<input(?=[^>]*type="checkbox")(?=[^>]*disabled)[^>]*>/,
    );
    expect(html).toMatch(
      /<input(?=[^>]*checked="")(?=[^>]*type="checkbox")(?=[^>]*disabled)[^>]*>/,
    );
    expect(html).toContain('문서 작성');
    expect(html).toContain('QA 완료');
    expect(html).toContain('[not-a-checkbox] 일반 항목');
  });

  it('keeps blockquotes as semantic preview elements', () => {
    const html = renderMarkdownPreview(
      '> 중요한 결정은 배경과 함께 기록합니다.\n>\n> 다음 작업에서 다시 확인합니다.',
    );

    expect(html).toContain('<blockquote>');
    expect(html).toContain('<p>중요한 결정은 배경과 함께 기록합니다.</p>');
    expect(html).toContain('<p>다음 작업에서 다시 확인합니다.</p>');
  });

  it('keeps Mermaid source in a local preview block for the renderer', () => {
    const html = renderMarkdownPreview(
      '```mermaid\nflowchart LR\n  A[Start] --> B[Finish]\n```',
    );

    expect(html).toContain('class="mermaid-block"');
    expect(html).toContain('Mermaid 미리보기를 준비하고 있습니다.');
    expect(html).toContain('class="mermaid-source"');
    expect(html).toContain('flowchart LR');
    expect(html).toContain('A[Start]');
  });
});
