import { describe, expect, it } from 'vitest';
import { getDocumentTemplate } from './document-templates';

describe('document templates', () => {
  it('returns an empty document for the blank template', () => {
    expect(getDocumentTemplate('blank')).toBe('');
  });

  it('returns reusable Markdown scaffolding for a technical note', () => {
    expect(getDocumentTemplate('technical-note')).toContain('## 핵심 내용');
    expect(getDocumentTemplate('technical-note')).toContain('```text');
  });
});
