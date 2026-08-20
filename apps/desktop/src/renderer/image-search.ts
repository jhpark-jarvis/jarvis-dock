export interface ImageSearchResult {
  id: string;
  title: string;
  sourcePageUrl: string;
  thumbnailUrl: string;
  downloadUrl: string;
  source: string;
  license?: string;
}

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
