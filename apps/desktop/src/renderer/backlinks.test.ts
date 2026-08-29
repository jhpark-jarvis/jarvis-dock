import { describe, expect, it } from 'vitest';
import { findBacklinks, findDocumentLinks } from './backlinks';

describe('backlinks', () => {
  it('finds internal Markdown links that point to the current document', () => {
    expect(
      findBacklinks(
        [
          {
            relativePath: 'guide.md',
            content: '# Guide\n\n[Design](./docs/design.md)',
          },
          {
            relativePath: 'notes/today.md',
            content:
              '[Design](../docs/design.md)\n![Image](../assets/design.png)',
          },
        ],
        'docs/design.md',
      ),
    ).toEqual([
      {
        relativePath: 'guide.md',
        line: 3,
        snippet: '[Design](./docs/design.md)',
      },
      {
        relativePath: 'notes/today.md',
        line: 1,
        snippet: '[Design](../docs/design.md)',
      },
    ]);
  });

  it('ignores external URLs, anchors, images, and non-Markdown files', () => {
    expect(
      findBacklinks(
        [
          {
            relativePath: 'guide.md',
            content:
              '[External](https://example.com/docs/design.md) [Anchor](#design) ![Image](./design.md)',
          },
        ],
        'design.md',
      ),
    ).toEqual([]);
  });

  it('resolves documents linked from the current document', () => {
    expect(
      findDocumentLinks(
        {
          relativePath: 'docs/architecture/arc42.md',
          content:
            '[Context](./c4-context.md)\n[Container](./c4-container.md)\n[Missing](./missing.md)',
        },
        new Set([
          'docs/architecture/arc42.md',
          'docs/architecture/c4-context.md',
          'docs/architecture/c4-container.md',
        ]),
      ),
    ).toEqual([
      {
        relativePath: 'docs/architecture/arc42.md',
        targetPath: 'docs/architecture/c4-context.md',
        line: 1,
        snippet: '[Context](./c4-context.md)',
      },
      {
        relativePath: 'docs/architecture/arc42.md',
        targetPath: 'docs/architecture/c4-container.md',
        line: 2,
        snippet: '[Container](./c4-container.md)',
      },
    ]);
  });
});
