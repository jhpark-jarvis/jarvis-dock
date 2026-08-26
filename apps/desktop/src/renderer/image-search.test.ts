import { describe, expect, it } from 'vitest';
import {
  createMockImageProvider,
  formatMarkdownImage,
  insertMarkdownImage,
} from './image-search';

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

  it('formats a safe relative Markdown image after download', () => {
    expect(formatMarkdownImage('A [diagram]', 'assets/diagram.png')).toBe(
      '![A \\[diagram\\]](./assets/diagram.png)',
    );
    expect(
      insertMarkdownImage(
        'before after',
        'diagram',
        'assets/diagram.png',
        7,
        12,
      ),
    ).toBe('before ![diagram](./assets/diagram.png)');
    expect(
      formatMarkdownImage('diagram', 'assets/diagram.png', 'docs/guide.md'),
    ).toBe('![diagram](../assets/diagram.png)');
    expect(() => formatMarkdownImage('diagram', '../outside.png')).toThrow();
  });
});
