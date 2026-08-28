import { describe, expect, it } from 'vitest';
import { diagnoseMarkdownDocument } from './document-diagnostics';

const workspacePaths = new Set(['guide.md', 'docs/design.md']);
const assetPaths = new Set(['assets/diagram.png']);

describe('diagnoseMarkdownDocument', () => {
  it('finds broken document links and missing workspace images', () => {
    const diagnostics = diagnoseMarkdownDocument({
      documentPath: 'guide.md',
      content:
        '# Guide\n\n[Design](./docs/design.md)\n[Missing](./missing.md)\n![diagram](./assets/missing.png)',
      workspacePaths,
      assetPaths,
    });

    expect(diagnostics.map(({ code }) => code)).toEqual([
      'missing-link',
      'missing-image',
    ]);
    expect(diagnostics[0].line).toBe(4);
    expect(diagnostics[1].line).toBe(5);
  });

  it('reports headings that are duplicated or skip a level', () => {
    const diagnostics = diagnoseMarkdownDocument({
      documentPath: 'guide.md',
      content: '# Guide\n\n### Details\n\n### Details',
      workspacePaths,
      assetPaths,
    });

    expect(diagnostics.map(({ code }) => code)).toEqual([
      'heading-level',
      'duplicate-heading',
    ]);
  });

  it('reports empty alt text and malformed Mermaid blocks', () => {
    const diagnostics = diagnoseMarkdownDocument({
      documentPath: 'guide.md',
      content: '![ ](./assets/diagram.png)\n\n```mermaid\n\n```',
      workspacePaths,
      assetPaths,
    });

    expect(diagnostics.map(({ code }) => code)).toEqual([
      'empty-alt',
      'empty-mermaid',
    ]);
  });

  it('reports Mermaid renderer errors without rejecting external links', () => {
    const diagnostics = diagnoseMarkdownDocument({
      documentPath: 'guide.md',
      content:
        '[Electron](https://www.electronjs.org)\n\n```mermaid\nflowchart LR\n A --> B\n```',
      workspacePaths,
      mermaidRenders: {
        0: { source: 'flowchart LR\n A --> B', error: 'invalid' },
      },
    });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: 'mermaid-syntax',
        severity: 'error',
        line: 3,
      }),
    ]);
  });
});
