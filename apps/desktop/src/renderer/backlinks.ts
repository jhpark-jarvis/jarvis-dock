export interface BacklinkDocument {
  relativePath: string;
  content: string;
}

export interface BacklinkResult {
  relativePath: string;
  line: number;
  snippet: string;
}

const markdownLinkPattern = /(!?)\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))/g;

const normalizePath = (value: string): string | undefined => {
  const parts: string[] = [];
  for (const part of value.replaceAll('\\', '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (parts.length === 0) return undefined;
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join('/');
};

const resolveDocumentLink = (
  sourcePath: string,
  target: string,
): string | undefined => {
  const cleanTarget = target.split(/[?#]/, 1)[0];
  if (
    !cleanTarget ||
    cleanTarget.startsWith('#') ||
    /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(cleanTarget)
  ) {
    return undefined;
  }
  const base = sourcePath.includes('/')
    ? sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1)
    : '';
  const normalized = normalizePath(`${base}${cleanTarget}`);
  return normalized && /\.(?:md|markdown)$/i.test(normalized)
    ? normalized
    : undefined;
};

export const findBacklinks = (
  documents: readonly BacklinkDocument[],
  targetPath: string,
): BacklinkResult[] => {
  const results: BacklinkResult[] = [];
  for (const document of documents) {
    const lines = document.content.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const match of line.matchAll(markdownLinkPattern)) {
        if (match[1] === '!') continue;
        const target = match[2] ?? match[3];
        if (
          target &&
          resolveDocumentLink(document.relativePath, target) === targetPath
        ) {
          results.push({
            relativePath: document.relativePath,
            line: index + 1,
            snippet: line.trim() || '(빈 줄)',
          });
          break;
        }
      }
    });
  }
  return results;
};
