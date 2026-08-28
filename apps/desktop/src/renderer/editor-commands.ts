export type EditorCommand = 'link' | 'image';

export interface EditorCommandSuggestion {
  command: EditorCommand;
  start: number;
  end: number;
}

const commandPattern = /(?:^|\s)(!link|!image)$/;

const isInsideFencedCodeBlock = (contentBeforeCursor: string): boolean => {
  let fenced = false;
  for (const line of contentBeforeCursor.split('\n')) {
    if (/^\s*```/.test(line)) fenced = !fenced;
  }
  return fenced;
};

export const findEditorCommandSuggestion = (
  content: string,
  cursor: number,
): EditorCommandSuggestion | undefined => {
  if (cursor < 0 || cursor > content.length) return undefined;
  const contentBeforeCursor = content.slice(0, cursor);
  if (isInsideFencedCodeBlock(contentBeforeCursor)) return undefined;

  const lineStart = contentBeforeCursor.lastIndexOf('\n') + 1;
  const line = contentBeforeCursor.slice(lineStart);
  const match = commandPattern.exec(line);
  if (!match) return undefined;

  const token = match[1];
  return {
    command: token === '!link' ? 'link' : 'image',
    start: lineStart + match.index + match[0].length - token.length,
    end: cursor,
  };
};
