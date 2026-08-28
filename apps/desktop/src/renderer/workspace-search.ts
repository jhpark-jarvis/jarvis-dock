import type { WorkspaceFile } from '../shared/ipc';

export interface WorkspaceSearchDocument {
  relativePath: string;
  content: string;
}

export interface WorkspaceSearchResult {
  relativePath: string;
  line: number;
  snippet: string;
}

const MAX_RESULTS = 100;

export const searchMarkdownDocuments = (
  documents: readonly WorkspaceSearchDocument[],
  query: string,
): WorkspaceSearchResult[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];

  const results: WorkspaceSearchResult[] = [];
  for (const document of documents) {
    const lines = document.content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!line.toLocaleLowerCase().includes(normalizedQuery)) return;
      results.push({
        relativePath: document.relativePath,
        line: index + 1,
        snippet: line.trim() || '(빈 줄)',
      });
    });
    if (results.length >= MAX_RESULTS) break;
  }
  return results.slice(0, MAX_RESULTS);
};

export const filterWorkspaceFiles = (
  files: readonly WorkspaceFile[],
  query: string,
): WorkspaceFile[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [...files];
  return files.filter((file) =>
    file.relativePath.toLocaleLowerCase().includes(normalizedQuery),
  );
};
