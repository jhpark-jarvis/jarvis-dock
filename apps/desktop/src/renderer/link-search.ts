export interface LinkSearchResult {
  title: string;
  url: string;
  source: string;
}

export interface LinkSearchProvider {
  search(query: string): Promise<LinkSearchResult[]>;
}

const MOCK_LINK_RESULTS: LinkSearchResult[] = [
  {
    title: 'Electron Security',
    url: 'https://www.electronjs.org/docs/latest/tutorial/security',
    source: 'Electron documentation',
  },
  {
    title: 'Electron BrowserWindow',
    url: 'https://www.electronjs.org/docs/latest/api/browser-window',
    source: 'Electron documentation',
  },
  {
    title: 'React Documentation',
    url: 'https://react.dev/learn',
    source: 'React documentation',
  },
  {
    title: 'CommonMark Spec',
    url: 'https://spec.commonmark.org/current/',
    source: 'CommonMark',
  },
];

export const isAllowedLinkUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const escapeMarkdownLinkText = (value: string): string =>
  value.replace(/[\\[\]]/g, '\\$&');

export const escapeMarkdownLinkUrl = (value: string): string =>
  value.replace(/[\\()]/g, '\\$&');

export const formatMarkdownLink = (result: LinkSearchResult): string => {
  if (!isAllowedLinkUrl(result.url)) {
    throw new Error('Only http and https URLs are allowed.');
  }
  return `[${escapeMarkdownLinkText(result.title)}](${escapeMarkdownLinkUrl(result.url)})`;
};

export const insertMarkdownLink = (
  content: string,
  result: LinkSearchResult,
  selectionStart: number,
  selectionEnd: number,
): string => {
  const start = Math.max(0, Math.min(selectionStart, content.length));
  const end = Math.max(start, Math.min(selectionEnd, content.length));
  const markdown = formatMarkdownLink(result);
  return `${content.slice(0, start)}${markdown}${content.slice(end)}`;
};

export const createMockLinkProvider = (): LinkSearchProvider => ({
  search: async (query: string) => {
    const normalized = query.trim().toLowerCase();
    if (normalized === 'error') {
      throw new Error('The mock provider failed.');
    }
    if (!normalized || normalized === 'empty' || normalized === 'none') {
      return [];
    }
    return MOCK_LINK_RESULTS.filter((result) =>
      `${result.title} ${result.url} ${result.source}`
        .toLowerCase()
        .includes(normalized),
    );
  },
});

export const mockLinkProvider = createMockLinkProvider();
