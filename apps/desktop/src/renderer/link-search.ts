import { isAllowedLinkUrl } from '../shared/link';

export { isAllowedLinkUrl } from '../shared/link';

export interface LinkInsertTarget {
  title: string;
  url: string;
}

export const escapeMarkdownLinkText = (value: string): string =>
  value.replace(/[\\[\]]/g, '\\$&');

export const escapeMarkdownLinkUrl = (value: string): string =>
  value.replace(/[\\()]/g, '\\$&');

export const formatMarkdownLink = (result: LinkInsertTarget): string => {
  if (!isAllowedLinkUrl(result.url)) {
    throw new Error('Only http and https URLs are allowed.');
  }
  return `[${escapeMarkdownLinkText(result.title)}](${escapeMarkdownLinkUrl(result.url)})`;
};

export const insertMarkdownLink = (
  content: string,
  result: LinkInsertTarget,
  selectionStart: number,
  selectionEnd: number,
): string => {
  const start = Math.max(0, Math.min(selectionStart, content.length));
  const end = Math.max(start, Math.min(selectionEnd, content.length));
  const markdown = formatMarkdownLink(result);
  return `${content.slice(0, start)}${markdown}${content.slice(end)}`;
};
