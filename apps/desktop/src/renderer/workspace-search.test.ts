import { describe, expect, it } from 'vitest';
import {
  filterWorkspaceFiles,
  searchMarkdownDocuments,
} from './workspace-search';

describe('workspace search', () => {
  it('finds matching lines case-insensitively and preserves line numbers', () => {
    expect(
      searchMarkdownDocuments(
        [
          { relativePath: 'guide.md', content: '# Setup\n\nInstall Dock' },
          { relativePath: 'notes.md', content: 'dock is local\nNo match' },
        ],
        'dock',
      ),
    ).toEqual([
      { relativePath: 'guide.md', line: 3, snippet: 'Install Dock' },
      { relativePath: 'notes.md', line: 1, snippet: 'dock is local' },
    ]);
  });

  it('filters quick-open candidates by their relative path', () => {
    expect(
      filterWorkspaceFiles(
        [
          { relativePath: 'docs/guide.md', displayName: 'guide.md' },
          { relativePath: 'notes/today.md', displayName: 'today.md' },
        ],
        'GUIDE',
      ),
    ).toEqual([{ relativePath: 'docs/guide.md', displayName: 'guide.md' }]);
  });
});
