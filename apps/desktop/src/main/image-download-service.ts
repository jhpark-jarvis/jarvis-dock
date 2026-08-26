import { constants as fsConstants, promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ImageDownloadResult, ImageSearchResult } from '../shared/ipc';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_DOWNLOAD_TIMEOUT_MS = 10_000;
export const MAX_IMAGE_REDIRECTS = 3;

const MIME_TO_EXTENSION = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
} as const;

export type ImageDownloadServiceErrorCode =
  | 'IMAGE_DOWNLOAD_FAILED'
  | 'IMAGE_TOO_LARGE'
  | 'IMAGE_UNSUPPORTED'
  | 'IMAGE_UNAVAILABLE';

export class ImageDownloadServiceError extends Error {
  constructor(
    public readonly code: ImageDownloadServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ImageDownloadServiceError';
  }
}

export interface ImageDownloadServiceDependencies {
  fetchImpl?: typeof fetch;
  allowedHosts: ReadonlySet<string>;
}

export interface DownloadImageRequest {
  root: string;
  image: ImageSearchResult;
}

const isInside = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
};

const validateDownloadUrl = (
  value: string,
  allowedHosts: ReadonlySet<string>,
): URL => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ImageDownloadServiceError(
      'IMAGE_UNSUPPORTED',
      'The image download URL is invalid.',
    );
  }
  if (
    url.protocol !== 'https:' ||
    url.port !== '' ||
    !allowedHosts.has(url.hostname.toLowerCase())
  ) {
    throw new ImageDownloadServiceError(
      'IMAGE_UNSUPPORTED',
      'The image download URL is not allowed.',
    );
  }
  return url;
};

const readResponseBytes = async (response: Response): Promise<Buffer> => {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_IMAGE_BYTES) {
    throw new ImageDownloadServiceError(
      'IMAGE_TOO_LARGE',
      'The image response is too large.',
    );
  }

  if (!response.body) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new ImageDownloadServiceError(
        'IMAGE_TOO_LARGE',
        'The image response is too large.',
      );
    }
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    let finished = false;
    while (!finished) {
      const next = await reader.read();
      finished = next.done;
      if (finished) break;
      total += next.value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        throw new ImageDownloadServiceError(
          'IMAGE_TOO_LARGE',
          'The image response is too large.',
        );
      }
      chunks.push(Buffer.from(next.value));
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks, total);
};

const getMimeType = (response: Response): keyof typeof MIME_TO_EXTENSION => {
  const mimeType = response.headers
    .get('content-type')
    ?.split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (!mimeType || !(mimeType in MIME_TO_EXTENSION)) {
    throw new ImageDownloadServiceError(
      'IMAGE_UNSUPPORTED',
      'The image format is not supported.',
    );
  }
  return mimeType as keyof typeof MIME_TO_EXTENSION;
};

const matchesMagicBytes = (
  bytes: Buffer,
  mimeType: keyof typeof MIME_TO_EXTENSION,
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

const createSafeStem = (title: string): string => {
  const stem = title
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80);
  if (!stem || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) {
    return 'image';
  }
  return stem;
};

const saveWithoutOverwrite = async (
  root: string,
  title: string,
  mimeType: keyof typeof MIME_TO_EXTENSION,
  bytes: Buffer,
): Promise<ImageDownloadResult> => {
  const realRoot = await fs.realpath(root);
  const assetDirectory = path.join(realRoot, 'assets');
  await fs.mkdir(assetDirectory, { recursive: true });
  const realAssetDirectory = await fs.realpath(assetDirectory);
  if (!isInside(realRoot, realAssetDirectory)) {
    throw new ImageDownloadServiceError(
      'IMAGE_DOWNLOAD_FAILED',
      'The asset directory is outside the document workspace.',
    );
  }

  const stem = createSafeStem(title);
  const extension = MIME_TO_EXTENSION[mimeType];
  const temporaryPath = path.join(
    realAssetDirectory,
    `.dock-${randomUUID()}.tmp`,
  );
  await fs.writeFile(temporaryPath, bytes, { flag: 'wx' });

  try {
    for (let index = 1; index <= 1000; index += 1) {
      const suffix = index === 1 ? '' : `-${index}`;
      const fileName = `${stem}${suffix}${extension}`;
      const absolutePath = path.join(realAssetDirectory, fileName);
      try {
        await fs.copyFile(
          temporaryPath,
          absolutePath,
          fsConstants.COPYFILE_EXCL,
        );
        await fs.unlink(temporaryPath);
        return {
          assetPath: path.posix.join('assets', fileName),
          bytesWritten: bytes.byteLength,
          mimeType,
        };
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException)?.code !== 'EEXIST') throw cause;
      }
    }
    throw new ImageDownloadServiceError(
      'IMAGE_DOWNLOAD_FAILED',
      'A unique image filename could not be created.',
    );
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
};

export const downloadImageToWorkspace = async (
  request: DownloadImageRequest,
  { fetchImpl = fetch, allowedHosts }: ImageDownloadServiceDependencies,
): Promise<ImageDownloadResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    IMAGE_DOWNLOAD_TIMEOUT_MS,
  );
  try {
    let url = validateDownloadUrl(request.image.downloadUrl, allowedHosts);
    let response: Response | undefined;
    for (let redirect = 0; redirect <= MAX_IMAGE_REDIRECTS; redirect += 1) {
      try {
        response = await fetchImpl(url, {
          method: 'GET',
          headers: { Accept: 'image/png,image/jpeg,image/webp' },
          redirect: 'manual',
          signal: controller.signal,
        });
      } catch {
        throw new ImageDownloadServiceError(
          'IMAGE_UNAVAILABLE',
          'The image provider is unavailable.',
        );
      }

      if (response.status < 300 || response.status >= 400) break;
      const location = response.headers.get('location');
      if (!location || redirect === MAX_IMAGE_REDIRECTS) {
        throw new ImageDownloadServiceError(
          'IMAGE_DOWNLOAD_FAILED',
          'The image redirect could not be validated.',
        );
      }
      url = validateDownloadUrl(
        new URL(location, url).toString(),
        allowedHosts,
      );
    }

    if (!response || !response.ok) {
      throw new ImageDownloadServiceError(
        'IMAGE_DOWNLOAD_FAILED',
        'The image provider returned an error.',
      );
    }
    const mimeType = getMimeType(response);
    const bytes = await readResponseBytes(response);
    if (!bytes.length || !matchesMagicBytes(bytes, mimeType)) {
      throw new ImageDownloadServiceError(
        'IMAGE_UNSUPPORTED',
        'The image bytes do not match the declared format.',
      );
    }
    return await saveWithoutOverwrite(
      request.root,
      request.image.title,
      mimeType,
      bytes,
    );
  } finally {
    clearTimeout(timeout);
  }
};

export const saveImageBytesToWorkspace = async (request: {
  root: string;
  title: string;
  mimeType: ImageDownloadResult['mimeType'];
  bytes: Uint8Array;
}): Promise<ImageDownloadResult> => {
  const bytes = Buffer.from(request.bytes);
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new ImageDownloadServiceError(
      'IMAGE_TOO_LARGE',
      'The image response is too large.',
    );
  }
  if (!bytes.length || !matchesMagicBytes(bytes, request.mimeType)) {
    throw new ImageDownloadServiceError(
      'IMAGE_UNSUPPORTED',
      'The image bytes do not match the declared format.',
    );
  }
  return saveWithoutOverwrite(
    request.root,
    request.title,
    request.mimeType,
    bytes,
  );
};
