import { describe, expect, it } from 'vitest';
import { extractDocumentOutline } from './document-outline';

describe('extractDocumentOutline', () => {
  it('extracts Markdown headings with their levels and lines', () => {
    expect(extractDocumentOutline('# Title\n\n## Setup ##\n### Usage')).toEqual(
      [
        { level: 1, line: 0, text: 'Title' },
        { level: 2, line: 2, text: 'Setup' },
        { level: 3, line: 3, text: 'Usage' },
      ],
    );
  });

  it('does not treat fenced code headings as document outline items', () => {
    expect(extractDocumentOutline('```md\n# Example\n```\n\n# Actual')).toEqual(
      [{ level: 1, line: 4, text: 'Actual' }],
    );
  });
});
