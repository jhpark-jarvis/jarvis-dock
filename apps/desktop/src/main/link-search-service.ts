import { z } from 'zod';
import { isAllowedLinkUrl } from '../shared/link';
import type { LinkSearchResult } from '../shared/ipc';

const BRAVE_SEARCH_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_RESULTS = 10;
const SEARCH_TIMEOUT_MS = 10_000;

const BraveResponseSchema = z
  .object({
    web: z
      .object({
        results: z.array(
          z
            .object({
              title: z.string(),
              url: z.string(),
              profile: z
                .object({ name: z.string().optional() })
                .passthrough()
                .optional(),
            })
            .passthrough(),
        ),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type LinkSearchServiceErrorCode =
  | 'SEARCH_FAILED'
  | 'SEARCH_RATE_LIMITED'
  | 'SEARCH_UNAVAILABLE';

export class LinkSearchServiceError extends Error {
  constructor(
    public readonly code: LinkSearchServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LinkSearchServiceError';
  }
}

const readResponseText = async (response: Response): Promise<string> => {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new LinkSearchServiceError(
      'SEARCH_FAILED',
      'The search response was too large.',
    );
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new LinkSearchServiceError(
      'SEARCH_FAILED',
      'The search response was too large.',
    );
  }
  return text;
};

export interface LinkSearchServiceDependencies {
  fetchImpl?: typeof fetch;
}

export const searchBraveLinks = async (
  query: string,
  apiKey: string,
  { fetchImpl = fetch }: LinkSearchServiceDependencies = {},
): Promise<LinkSearchResult[]> => {
  const endpoint = new URL(BRAVE_SEARCH_ENDPOINT);
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('count', String(MAX_RESULTS));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': apiKey,
        },
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      throw new LinkSearchServiceError(
        'SEARCH_UNAVAILABLE',
        'The search provider is unavailable.',
      );
    }

    if (response.status === 429) {
      throw new LinkSearchServiceError(
        'SEARCH_RATE_LIMITED',
        'The search provider rate limit was reached.',
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new LinkSearchServiceError(
        'SEARCH_FAILED',
        'The search provider rejected the API key.',
      );
    }
    if (!response.ok) {
      throw new LinkSearchServiceError(
        'SEARCH_FAILED',
        'The search provider returned an error.',
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(await readResponseText(response));
    } catch (cause) {
      if (cause instanceof LinkSearchServiceError) throw cause;
      throw new LinkSearchServiceError(
        'SEARCH_FAILED',
        'The search provider returned an invalid response.',
      );
    }

    const parsed = BraveResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new LinkSearchServiceError(
        'SEARCH_FAILED',
        'The search provider returned an invalid response.',
      );
    }

    return (parsed.data.web?.results ?? [])
      .map((result) => ({
        title: result.title.trim(),
        url: result.url.trim(),
        source: result.profile?.name?.trim() || 'Brave Search',
      }))
      .filter(
        (result) => result.title.length > 0 && isAllowedLinkUrl(result.url),
      )
      .slice(0, MAX_RESULTS);
  } finally {
    clearTimeout(timeout);
  }
};
