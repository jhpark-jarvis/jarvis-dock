import type { ImageSearchResult as SharedImageSearchResult } from '../shared/ipc';

export type ImageSearchResult = SharedImageSearchResult;

export interface ImageSearchProvider {
  search(query: string): Promise<ImageSearchResult[]>;
}

const MOCK_IMAGE_RESULTS: ImageSearchResult[] = [
  {
    id: 'electron-process-model',
    title: 'Electron process model',
    sourcePageUrl:
      'https://www.electronjs.org/docs/latest/tutorial/process-model',
    thumbnailUrl: 'https://images.example.test/electron-process-model.png',
    downloadUrl: 'https://images.example.test/electron-process-model.png',
    source: 'Electron documentation',
    license: 'Documentation illustration',
  },
  {
    id: 'desktop-workspace',
    title: 'Desktop workspace illustration',
    sourcePageUrl: 'https://example.com/images/desktop-workspace',
    thumbnailUrl: 'https://images.example.test/desktop-workspace.png',
    downloadUrl: 'https://images.example.test/desktop-workspace.png',
    source: 'Example image library',
    license: 'Mock result',
  },
];

export const createMockImageProvider = (): ImageSearchProvider => ({
  search: async (query: string) => {
    const normalized = query.trim().toLowerCase();
    if (normalized === 'error') {
      throw new Error('The mock image provider failed.');
    }
    if (!normalized || normalized === 'empty' || normalized === 'none') {
      return [];
    }
    return MOCK_IMAGE_RESULTS.filter((result) =>
      `${result.title} ${result.source} ${result.license ?? ''}`
        .toLowerCase()
        .includes(normalized),
    );
  },
});

export const mockImageProvider = createMockImageProvider();

export const escapeMarkdownImageAlt = (value: string): string =>
  value.replace(/[\\[\]]/g, '\\$&');

export const formatMarkdownImage = (
  altText: string,
  assetPath: string,
): string => {
  if (
    !assetPath.startsWith('assets/') ||
    assetPath.includes('..') ||
    assetPath.includes('\\') ||
    Array.from(assetPath).some((character) => character.charCodeAt(0) < 32)
  ) {
    throw new Error('Only safe workspace asset paths are allowed.');
  }
  return `![${escapeMarkdownImageAlt(altText)}](./${assetPath})`;
};

export const insertMarkdownImage = (
  content: string,
  altText: string,
  assetPath: string,
  selectionStart: number,
  selectionEnd: number,
): string => {
  const start = Math.max(0, Math.min(selectionStart, content.length));
  const end = Math.max(start, Math.min(selectionEnd, content.length));
  const markdown = formatMarkdownImage(altText, assetPath);
  return `${content.slice(0, start)}${markdown}${content.slice(end)}`;
};
