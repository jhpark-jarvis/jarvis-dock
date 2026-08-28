import { describe, expect, it } from 'vitest';
import { findBacklinks } from './backlinks';

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
});
