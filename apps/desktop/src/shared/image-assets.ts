const hasUrlScheme = /^[a-z][a-z\d+.-]*:/i;

const decodePath = (value: string): string | undefined => {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
};

const normalizeSegments = (segments: string[]): string[] | undefined => {
  const normalized: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (normalized.length === 0) return undefined;
      normalized.pop();
      continue;
    }
    normalized.push(segment);
  }
  return normalized;
};

const documentDirectory = (documentPath: string): string[] => {
  const segments = documentPath.split('/');
  segments.pop();
  return normalizeSegments(segments) ?? [];
};

const isWorkspaceAssetPath = (value: string): boolean =>
  value.startsWith('assets/') && value.length > 'assets/'.length;

export const normalizeWorkspaceAssetPath = (
  documentPath: string,
  source: string,
): string | undefined => {
  const trimmed = source.trim();
  if (
    !trimmed ||
    hasUrlScheme.test(trimmed) ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/') ||
    trimmed.includes('\\') ||
    trimmed.includes('\0')
  ) {
    return undefined;
  }

  const withoutFragment = trimmed.split(/[?#]/, 1)[0];
  const decoded = decodePath(withoutFragment);
  if (!decoded || decoded.includes('\\') || decoded.includes('\0')) {
    return undefined;
  }
  const normalized = normalizeSegments([
    ...documentDirectory(documentPath),
    ...decoded.split('/'),
  ]);
  if (!normalized) return undefined;
  const assetPath = normalized.join('/');
  return isWorkspaceAssetPath(assetPath) ? assetPath : undefined;
};

export const formatWorkspaceAssetReference = (
  documentPath: string,
  assetPath: string,
): string => {
  const normalizedAssetPath = normalizeWorkspaceAssetPath('', assetPath);
  if (!normalizedAssetPath) {
    throw new Error('Only workspace asset paths are allowed.');
  }

  const from = documentDirectory(documentPath);
  const to = normalizedAssetPath.split('/');
  let common = 0;
  while (common < from.length && from[common] === to[common]) common += 1;
  const relative = [
    ...Array.from({ length: from.length - common }, () => '..'),
    ...to.slice(common),
  ];
  const reference = relative.join('/');
  return reference.startsWith('../') ? reference : `./${reference}`;
};

const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/g;

export const extractWorkspaceImageAssets = (
  content: string,
  documentPath: string,
): string[] => {
  const assets = new Set<string>();
  for (const match of content.matchAll(MARKDOWN_IMAGE_PATTERN)) {
    const source = match[1] ?? match[2];
    if (!source) continue;
    const assetPath = normalizeWorkspaceAssetPath(documentPath, source);
    if (assetPath) assets.add(assetPath);
  }
  return [...assets];
};

export const findRemovedWorkspaceImageAssets = (
  previousContent: string,
  nextContent: string,
  documentPath: string,
): string[] => {
  const nextAssets = new Set(
    extractWorkspaceImageAssets(nextContent, documentPath),
  );
  return extractWorkspaceImageAssets(previousContent, documentPath).filter(
    (assetPath) => !nextAssets.has(assetPath),
  );
};
