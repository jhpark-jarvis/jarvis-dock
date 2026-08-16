export const PRODUCTION_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https:",
  "connect-src 'self' https:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
].join('; ');

type ResponseHeaders = Record<string, string[] | undefined>;

export const isTrustedRendererUrl = (
  senderUrl: string,
  rendererUrl: string,
): boolean => {
  try {
    return new URL(senderUrl).toString() === new URL(rendererUrl).toString();
  } catch {
    return false;
  }
};

export const isAllowedRendererNavigation = (
  targetUrl: string,
  rendererUrl: string,
): boolean => isTrustedRendererUrl(targetUrl, rendererUrl);

export const withContentSecurityPolicy = (
  responseHeaders: ResponseHeaders,
): ResponseHeaders => {
  const headersWithoutCsp = Object.fromEntries(
    Object.entries(responseHeaders).filter(
      ([headerName]) => headerName.toLowerCase() !== 'content-security-policy',
    ),
  );

  return {
    ...headersWithoutCsp,
    'Content-Security-Policy': [PRODUCTION_CONTENT_SECURITY_POLICY],
  };
};
