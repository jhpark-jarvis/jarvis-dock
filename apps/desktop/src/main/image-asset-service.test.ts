import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  deleteUnusedImageAsset,
  listImageAssetsFromWorkspace,
  readImageAssetFromWorkspace,
} from './image-asset-service';

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

const createAssetWorkspace = async (content: string) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-dock-assets-'));
  roots.push(root);
  await fs.mkdir(path.join(root, 'assets'), { recursive: true });
  await fs.writeFile(path.join(root, 'assets', 'image.png'), PNG);
  await fs.writeFile(path.join(root, 'guide.md'), content);
  return root;
};

describe('workspace image asset service', () => {
  it('reads a workspace image as a bounded data URL for preview', async () => {
    const root = await createAssetWorkspace('![image](./assets/image.png)');

    await expect(
      readImageAssetFromWorkspace({ root, assetPath: 'assets/image.png' }),
    ).resolves.toEqual({
      assetPath: 'assets/image.png',
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      mimeType: 'image/png',
    });
  });

  it('deletes an asset only when no Markdown document references it', async () => {
    const root = await createAssetWorkspace('![image](./assets/image.png)');

    await expect(
      deleteUnusedImageAsset({ root, assetPath: 'assets/image.png' }),
    ).resolves.toEqual({ assetPath: 'assets/image.png', deleted: false });
    await expect(
      fs.access(path.join(root, 'assets', 'image.png')),
    ).resolves.toBeUndefined();

    await fs.writeFile(path.join(root, 'guide.md'), '# Guide');
    await expect(
      deleteUnusedImageAsset({ root, assetPath: 'assets/image.png' }),
    ).resolves.toEqual({ assetPath: 'assets/image.png', deleted: true });
    await expect(
      fs.access(path.join(root, 'assets', 'image.png')),
    ).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('lists supported image assets recursively and skips unrelated files', async () => {
    const root = await createAssetWorkspace('# Guide');
    await fs.mkdir(path.join(root, 'assets', 'nested'));
    await fs.writeFile(
      path.join(root, 'assets', 'nested', 'diagram.webp'),
      PNG,
    );
    await fs.writeFile(path.join(root, 'assets', 'notes.txt'), 'not an image');

    await expect(listImageAssetsFromWorkspace(root)).resolves.toEqual([
      { assetPath: 'assets/image.png', displayName: 'image.png' },
      { assetPath: 'assets/nested/diagram.webp', displayName: 'diagram.webp' },
    ]);
  });
});
