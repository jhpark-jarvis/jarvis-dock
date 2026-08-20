import { describe, expect, it } from 'vitest';
import { createMockImageProvider } from './image-search';

describe('mock image search provider', () => {
  it('returns image metadata for a matching query', async () => {
    await expect(
      createMockImageProvider().search('electron'),
    ).resolves.toMatchObject([
      {
        id: 'electron-process-model',
        title: 'Electron process model',
        sourcePageUrl: expect.stringMatching(/^https:\/\//),
        thumbnailUrl: expect.stringMatching(/^https:\/\//),
        downloadUrl: expect.stringMatching(/^https:\/\//),
        source: 'Electron documentation',
      },
    ]);
  });

  it('distinguishes empty and failed searches', async () => {
    const provider = createMockImageProvider();

    await expect(provider.search('none')).resolves.toEqual([]);
    await expect(provider.search('error')).rejects.toThrow(
      'The mock image provider failed.',
    );
  });
});
