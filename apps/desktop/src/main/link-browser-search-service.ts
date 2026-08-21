const GOOGLE_SEARCH_URL = 'https://www.google.com/search';

export interface LinkBrowserSearchDependencies {
  openExternal: (url: string) => Promise<void>;
}

export const createGoogleSearchUrl = (query: string): string => {
  const url = new URL(GOOGLE_SEARCH_URL);
  url.searchParams.set('q', query);
  return url.toString();
};

export const openLinkBrowserSearch = async (
  query: string,
  { openExternal }: LinkBrowserSearchDependencies,
): Promise<void> => openExternal(createGoogleSearchUrl(query));
