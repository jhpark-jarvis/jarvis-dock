import { describe, expect, it } from 'vitest';
import {
  extractWorkspaceImageAssets,
  findRemovedWorkspaceImageAssets,
  formatWorkspaceAssetReference,
  normalizeWorkspaceAssetPath,
} from './image-assets';

describe('workspace image asset paths', () => {
  it('resolves image references from a Markdown file to workspace assets', () => {
    expect(
      normalizeWorkspaceAssetPath('docs/guide.md', '../assets/one.png'),
    ).toBe('assets/one.png');
    expect(
      formatWorkspaceAssetReference('docs/guide.md', 'assets/one.png'),
    ).toBe('../assets/one.png');
    expect(
      extractWorkspaceImageAssets(
        '![one](../assets/one.png) ![two](../assets/two.png "title")',
        'docs/guide.md',
      ),
    ).toEqual(['assets/one.png', 'assets/two.png']);
  });

  it('finds only image assets removed from the saved document', () => {
    expect(
      findRemovedWorkspaceImageAssets(
        '![one](./assets/one.png)\n![two](./assets/two.png)',
        '![two](./assets/two.png)',
        'guide.md',
      ),
    ).toEqual(['assets/one.png']);
  });

  it('rejects remote and escaping image references', () => {
    expect(
      normalizeWorkspaceAssetPath('guide.md', 'https://example.com/a.png'),
    ).toBe(undefined);
    expect(normalizeWorkspaceAssetPath('guide.md', '../assets/a.png')).toBe(
      undefined,
    );
    expect(
      normalizeWorkspaceAssetPath('guide.md', 'assets/../secret.png'),
    ).toBe(undefined);
  });
});
