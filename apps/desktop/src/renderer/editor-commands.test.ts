import { describe, expect, it } from 'vitest';
import { findEditorCommandSuggestion } from './editor-commands';

describe('findEditorCommandSuggestion', () => {
  it('detects a link command at the current cursor', () => {
    expect(findEditorCommandSuggestion('설명 /link', 8)).toEqual({
      command: 'link',
      start: 3,
      end: 8,
    });
  });

  it('detects an image command after a newline', () => {
    expect(findEditorCommandSuggestion('첫 줄\n/image', 10)).toEqual({
      command: 'image',
      start: 4,
      end: 10,
    });
  });

  it('does not suggest a command in a fenced code block', () => {
    const content = '```ts\nconst command = "/link";';
    expect(
      findEditorCommandSuggestion(content, content.length),
    ).toBeUndefined();
  });

  it('requires a command token at the end of the current line', () => {
    expect(findEditorCommandSuggestion('/link 설명', 8)).toBeUndefined();
    expect(findEditorCommandSuggestion('prefix/link', 11)).toBeUndefined();
  });

  it('does not suggest a command inside a URL path', () => {
    const content = 'https://example.com/path/link';
    expect(
      findEditorCommandSuggestion(content, content.length),
    ).toBeUndefined();
  });
});
