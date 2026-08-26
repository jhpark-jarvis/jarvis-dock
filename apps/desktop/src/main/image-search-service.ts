import { z } from 'zod';
import type { ImageSearchResult } from '../shared/ipc';

const WIKIMEDIA_API_ENDPOINT = 'https://commons.wikimedia.org/w/api.php';
const WIKIMEDIA_HOSTS = new Set([
  'commons.wikimedia.org',
  'upload.wikimedia.org',
]);
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_RESULTS = 8;
const SEARCH_TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const WikimediaMetadataSchema = z
  .record(z.string(), z.object({ value: z.unknown().optional() }).passthrough())
  .optional();

const WikimediaImageInfoSchema = z
  .object({
    url: z.string().url(),
    thumburl: z.string().url().optional(),
    mime: z.string(),
    size: z.number().nonnegative().optional(),
    extmetadata: WikimediaMetadataSchema,
  })
  .passthrough();

const WikimediaPageSchema = z
  .object({
    pageid: z.number().int().positive().optional(),
    title: z.string(),
    fullurl: z.string().url().optional(),
    imageinfo: z.array(WikimediaImageInfoSchema).min(1),
  })
  .passthrough();

const WikimediaResponseSchema = z
  .object({
    query: z
      .object({ pages: z.array(WikimediaPageSchema).optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type ImageSearchServiceErrorCode =
  | 'IMAGE_SEARCH_FAILED'
  | 'IMAGE_SEARCH_UNAVAILABLE';

export class ImageSearchServiceError extends Error {
  constructor(
    public readonly code: ImageSearchServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ImageSearchServiceError';
  }
}

export interface ImageSearchServiceDependencies {
  fetchImpl?: typeof fetch;
}

const readResponseText = async (response: Response): Promise<string> => {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new ImageSearchServiceError(
      'IMAGE_SEARCH_FAILED',
      'The image search response was too large.',
    );
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new ImageSearchServiceError(
      'IMAGE_SEARCH_FAILED',
      'The image search response was too large.',
    );
  }
  return text;
};

const plainMetadata = (
  metadata: Record<string, { value?: unknown }> | undefined,
  key: string,
): string => {
  const value = metadata?.[key]?.value;
  if (typeof value !== 'string' && typeof value !== 'number') return '';

  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const isAllowedProviderUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.port === '' &&
      WIKIMEDIA_HOSTS.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
};

const toImageResult = (
  page: z.infer<typeof WikimediaPageSchema>,
): ImageSearchResult | undefined => {
  const info = page.imageinfo[0];
  const mime = info.mime.toLowerCase();
  if (
    !SUPPORTED_MIME_TYPES.has(mime) ||
    (info.size !== undefined && info.size > MAX_IMAGE_BYTES) ||
    !isAllowedProviderUrl(info.url) ||
    (info.thumburl !== undefined && !isAllowedProviderUrl(info.thumburl))
  ) {
    return undefined;
  }

  const title = page.title.replace(/^File:/i, '').trim();
  const sourcePageUrl =
    page.fullurl ??
    `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title).replace(/%20/g, '_')}`;
  if (!title || !isAllowedProviderUrl(sourcePageUrl)) return undefined;

  const license = plainMetadata(info.extmetadata, 'LicenseShortName');
  const artist = plainMetadata(info.extmetadata, 'Artist');
  const licenseLabel = [license, artist ? `저작자: ${artist}` : '']
    .filter(Boolean)
    .join(' · ')
    .slice(0, 200);

  return {
    id: String(page.pageid ?? page.title),
    title,
    sourcePageUrl,
    thumbnailUrl: info.thumburl ?? info.url,
    downloadUrl: info.url,
    source: 'Wikimedia Commons',
    license: licenseLabel || '라이선스는 원본 페이지에서 확인하세요.',
  };
};

export const searchWikimediaImages = async (
  query: string,
  { fetchImpl = fetch }: ImageSearchServiceDependencies = {},
): Promise<ImageSearchResult[]> => {
  const endpoint = new URL(WIKIMEDIA_API_ENDPOINT);
  endpoint.searchParams.set('action', 'query');
  endpoint.searchParams.set('generator', 'search');
  endpoint.searchParams.set('gsrsearch', query);
  endpoint.searchParams.set('gsrnamespace', '6');
  endpoint.searchParams.set('gsrlimit', String(MAX_RESULTS));
  endpoint.searchParams.set('prop', 'imageinfo');
  endpoint.searchParams.set('iiprop', 'url|mime|size|extmetadata');
  endpoint.searchParams.set('iiurlwidth', '320');
  endpoint.searchParams.set('format', 'json');
  endpoint.searchParams.set('formatversion', '2');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'JARVIS Dock/1.0 (https://github.com/jhpark-jarvis/jarvis-dock)',
        },
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      throw new ImageSearchServiceError(
        'IMAGE_SEARCH_UNAVAILABLE',
        'The image search provider is unavailable.',
      );
    }

    if (!response.ok) {
      throw new ImageSearchServiceError(
        'IMAGE_SEARCH_FAILED',
        'The image search provider returned an error.',
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(await readResponseText(response));
    } catch (cause) {
      if (cause instanceof ImageSearchServiceError) throw cause;
      throw new ImageSearchServiceError(
        'IMAGE_SEARCH_FAILED',
        'The image search provider returned an invalid response.',
      );
    }

    const parsed = WikimediaResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ImageSearchServiceError(
        'IMAGE_SEARCH_FAILED',
        'The image search provider returned an invalid response.',
      );
    }

    return (parsed.data.query?.pages ?? [])
      .map(toImageResult)
      .filter((result): result is ImageSearchResult => result !== undefined)
      .slice(0, MAX_RESULTS);
  } finally {
    clearTimeout(timeout);
  }
};

export const WIKIMEDIA_IMAGE_HOSTS = WIKIMEDIA_HOSTS;
