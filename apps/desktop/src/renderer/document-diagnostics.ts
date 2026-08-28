import { normalizeWorkspaceAssetPath } from '../shared/image-assets';
import { extractDocumentOutline } from './document-outline';

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface DocumentDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  line?: number;
}

interface MermaidRenderState {
  source: string;
  error?: string;
}

export interface DocumentDiagnosticsOptions {
  documentPath: string;
  content: string;
  workspacePaths: ReadonlySet<string>;
  assetPaths?: ReadonlySet<string>;
  mermaidRenders?: Readonly<Record<number, MermaidRenderState>>;
}

const markdownReferencePattern =
  /(!?)\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^\s)]+))/g;
const mermaidFencePattern = /^ {0,3}(```|~~~)mermaid\s*$/i;
const schemePattern = /^[a-z][a-z\d+.-]*:/i;

const lineAt = (content: string, offset: number): number =>
  content.slice(0, offset).split(/\r?\n/).length;

const normalizeDocumentReference = (
  documentPath: string,
  source: string,
): string | undefined => {
  const trimmed = source.trim();
  if (
    !trimmed ||
    trimmed.startsWith('#') ||
    schemePattern.test(trimmed) ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/') ||
    trimmed.includes('\\') ||
    trimmed.includes('\0')
  ) {
    return undefined;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed.split(/[?#]/, 1)[0]);
  } catch {
    return undefined;
  }
  if (!/\.(md|markdown)$/i.test(decoded)) return undefined;

  const segments = documentPath.split('/');
  segments.pop();
  for (const segment of decoded.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) return undefined;
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  return segments.join('/');
};

const collectMermaidErrors = (
  content: string,
  renders: Readonly<Record<number, MermaidRenderState>> | undefined,
): DocumentDiagnostic[] => {
  const diagnostics: DocumentDiagnostic[] = [];
  const lines = content.split(/\r?\n/);
  let insideMermaid = false;
  let fence: string | undefined;
  let sourceLines: string[] = [];
  let startLine = 0;
  let blockIndex = 0;

  lines.forEach((line, lineIndex) => {
    const opening = line.match(mermaidFencePattern);
    if (!insideMermaid && opening) {
      insideMermaid = true;
      fence = opening[1];
      sourceLines = [];
      startLine = lineIndex;
      return;
    }
    if (!insideMermaid) return;
    if (new RegExp(`^ {0,3}${fence}\\s*$`).test(line)) {
      const source = sourceLines.join('\n');
      if (!source.trim()) {
        diagnostics.push({
          code: 'empty-mermaid',
          severity: 'error',
          message: 'Mermaid 다이어그램 원문이 비어 있습니다.',
          line: startLine + 1,
        });
      } else if (renders?.[blockIndex]?.error) {
        diagnostics.push({
          code: 'mermaid-syntax',
          severity: 'error',
          message: 'Mermaid 다이어그램 문법을 확인해 주세요.',
          line: startLine + 1,
        });
      }
      blockIndex += 1;
      insideMermaid = false;
      fence = undefined;
      sourceLines = [];
      return;
    }
    sourceLines.push(line);
  });

  if (insideMermaid) {
    diagnostics.push({
      code: 'unclosed-mermaid',
      severity: 'error',
      message: 'Mermaid 코드 블록의 닫는 fence가 없습니다.',
      line: startLine + 1,
    });
  }
  return diagnostics;
};

export const diagnoseMarkdownDocument = ({
  documentPath,
  content,
  workspacePaths,
  assetPaths = new Set(),
  mermaidRenders,
}: DocumentDiagnosticsOptions): DocumentDiagnostic[] => {
  const diagnostics: DocumentDiagnostic[] = [];
  const normalizedWorkspacePaths = new Set(
    [...workspacePaths].map((value) => value.toLowerCase()),
  );
  const headingOccurrences = new Map<string, number>();
  const outline = extractDocumentOutline(content);

  outline.forEach((heading) => {
    const key = heading.text.replace(/\s+/g, ' ').trim().toLowerCase();
    const previousLine = headingOccurrences.get(key);
    if (previousLine !== undefined) {
      diagnostics.push({
        code: 'duplicate-heading',
        severity: 'warning',
        message: `같은 제목이 ${previousLine}행에 이미 있습니다: ${heading.text}`,
        line: heading.line + 1,
      });
    } else {
      headingOccurrences.set(key, heading.line + 1);
    }
  });

  outline.forEach((heading, index) => {
    const previous = outline[index - 1];
    if (previous && heading.level > previous.level + 1) {
      diagnostics.push({
        code: 'heading-level',
        severity: 'warning',
        message: `제목 단계가 ${previous.level}에서 ${heading.level}로 건너뜁니다.`,
        line: heading.line + 1,
      });
    }
  });

  for (const match of content.matchAll(markdownReferencePattern)) {
    const source = match[3] ?? match[4] ?? '';
    const line = lineAt(content, match.index ?? 0);
    const isImage = match[1] === '!';
    const label = match[2].trim();

    if (isImage) {
      if (!label) {
        diagnostics.push({
          code: 'empty-alt',
          severity: 'warning',
          message: '이미지 설명(alt text)이 비어 있습니다.',
          line,
        });
      }
      if (schemePattern.test(source) || source.startsWith('//')) continue;
      const assetPath = normalizeWorkspaceAssetPath(documentPath, source);
      if (!assetPath) {
        diagnostics.push({
          code: 'invalid-image-path',
          severity: 'error',
          message:
            '이미지는 document workspace의 assets 폴더만 참조할 수 있습니다.',
          line,
        });
      } else if (!assetPaths.has(assetPath)) {
        diagnostics.push({
          code: 'missing-image',
          severity: 'error',
          message: `이미지 파일을 찾을 수 없습니다: ${assetPath}`,
          line,
        });
      }
      continue;
    }

    const normalizedPath = normalizeDocumentReference(documentPath, source);
    if (!normalizedPath) continue;
    if (!normalizedWorkspacePaths.has(normalizedPath.toLowerCase())) {
      diagnostics.push({
        code: 'missing-link',
        severity: 'error',
        message: `문서 링크 대상을 찾을 수 없습니다: ${normalizedPath}`,
        line,
      });
    }
  }

  diagnostics.push(...collectMermaidErrors(content, mermaidRenders));
  return diagnostics.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
};
