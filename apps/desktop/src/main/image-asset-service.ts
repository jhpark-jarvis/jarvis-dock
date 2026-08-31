import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  ImageAssetDeleteResult,
  ImageAssetReadResult,
} from '../shared/ipc';
import {
  extractWorkspaceImageAssets,
  normalizeWorkspaceAssetPath,
} from '../shared/image-assets';
import {
  DEFAULT_IGNORED_DIRECTORIES,
  listMarkdownFiles,
} from './workspace-service';
import { MAX_IMAGE_BYTES } from './image-download-service';

const isInside = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
};

export type ImageAssetServiceErrorCode =
  | 'IMAGE_ASSET_IN_USE'
  | 'IMAGE_UNSUPPORTED';

export class ImageAssetServiceError extends Error {
  constructor(
    public readonly code: ImageAssetServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ImageAssetServiceError';
  }
}

type SupportedMimeType = ImageAssetReadResult['mimeType'];

const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const MAX_LISTED_IMAGE_ASSETS = 200;

const matchesMagicBytes = (
  bytes: Buffer,
  mimeType: SupportedMimeType,
): boolean => {
  if (mimeType === 'image/png') {
    return Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).equals(
      bytes.subarray(0, 8),
    );
  }
  if (mimeType === 'image/jpeg') {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }
  return (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  );
};

const mimeFromBytes = (bytes: Buffer): SupportedMimeType | undefined => {
  if (matchesMagicBytes(bytes, 'image/png')) return 'image/png';
  if (matchesMagicBytes(bytes, 'image/jpeg')) return 'image/jpeg';
  if (matchesMagicBytes(bytes, 'image/webp')) return 'image/webp';
  return undefined;
};

const collectImageAssets = async (
  root: string,
  current: string,
): Promise<{ assetPath: string; displayName: string }[]> => {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const assets: { assetPath: string; displayName: string }[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      if (DEFAULT_IGNORED_DIRECTORIES.has(entry.name)) continue;
      assets.push(...(await collectImageAssets(root, absolutePath)));
      continue;
    }
    if (
      !entry.isFile() ||
      !SUPPORTED_IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    ) {
      continue;
    }
    assets.push({
      assetPath: path.relative(root, absolutePath).split(path.sep).join('/'),
      displayName: entry.name,
    });
  }
  return assets;
};

export const listImageAssetsFromWorkspace = async (
  rootPath: string,
): Promise<{ assetPath: string; displayName: string }[]> => {
  const root = await fs.realpath(rootPath);
  const assetRoot = path.join(root, 'assets');
  try {
    const stat = await fs.stat(assetRoot);
    if (!stat.isDirectory()) return [];
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    throw cause;
  }
  const assets = await collectImageAssets(root, assetRoot);
  return assets
    .sort((a, b) => a.assetPath.localeCompare(b.assetPath))
    .slice(0, MAX_LISTED_IMAGE_ASSETS);
};

const resolveAsset = async (
  rootPath: string,
  assetPath: string,
): Promise<{ root: string; absolutePath: string; assetPath: string }> => {
  const normalized = normalizeWorkspaceAssetPath('', assetPath);
  if (normalized !== assetPath) {
    throw new ImageAssetServiceError(
      'IMAGE_UNSUPPORTED',
      'The image asset path is invalid.',
    );
  }
  const root = await fs.realpath(rootPath);
  const assetRoot = path.join(root, 'assets');
  const absolutePath = path.resolve(root, ...assetPath.split('/'));
  if (!isInside(assetRoot, absolutePath)) {
    throw new ImageAssetServiceError(
      'IMAGE_UNSUPPORTED',
      'The image asset path is outside the assets directory.',
    );
  }
  const realAssetRoot = await fs.realpath(assetRoot);
  const realPath = await fs.realpath(absolutePath);
  if (!isInside(root, realPath) || !isInside(realAssetRoot, realPath)) {
    throw new ImageAssetServiceError(
      'IMAGE_UNSUPPORTED',
      'The image asset path is outside the document workspace.',
    );
  }
  return { root, absolutePath: realPath, assetPath };
};

export const readImageAssetFromWorkspace = async (request: {
  root: string;
  assetPath: string;
}): Promise<ImageAssetReadResult> => {
  const resolved = await resolveAsset(request.root, request.assetPath);
  const stat = await fs.stat(resolved.absolutePath);
  if (!stat.isFile() || stat.size > MAX_IMAGE_BYTES) {
    throw new ImageAssetServiceError(
      'IMAGE_UNSUPPORTED',
      'The image asset is not a supported file.',
    );
  }
  const bytes = await fs.readFile(resolved.absolutePath);
  const mimeType = mimeFromBytes(bytes);
  if (!mimeType) {
    throw new ImageAssetServiceError(
      'IMAGE_UNSUPPORTED',
      'The image asset format is not supported.',
    );
  }
  return {
    assetPath: resolved.assetPath,
    dataUrl: `data:${mimeType};base64,${bytes.toString('base64')}`,
    mimeType,
  };
};

export const deleteUnusedImageAsset = async (request: {
  root: string;
  assetPath: string;
}): Promise<ImageAssetDeleteResult> => {
  const resolved = await resolveAsset(request.root, request.assetPath);
  const files = await listMarkdownFiles(resolved.root);
  for (const file of files) {
    const content = await fs.readFile(
      path.resolve(resolved.root, ...file.relativePath.split('/')),
      'utf8',
    );
    if (
      extractWorkspaceImageAssets(content, file.relativePath).includes(
        resolved.assetPath,
      )
    ) {
      return { assetPath: resolved.assetPath, deleted: false };
    }
  }
  await fs.rm(resolved.absolutePath);
  return { assetPath: resolved.assetPath, deleted: true };
};
