import createDOMPurify from 'dompurify';
import { marked } from 'marked';
import { normalizeWorkspaceAssetPath } from '../shared/image-assets';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const highlightedLanguages = new Set([
  'bash',
  'css',
  'html',
  'javascript',
  'js',
  'json',
  'python',
  'py',
  'shell',
  'typescript',
  'ts',
]);

const tokenPattern =
  /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|#[^\n]*|\b(?:as|async|await|class|const|def|else|export|extends|false|from|function|if|import|in|interface|let|new|None|null|return|true|try|type|var|while|with|yield)\b|\b\d+(?:\.\d+)?\b)/g;

const tokenClass = (token: string): string => {
  if (/^(?:"|'|`)/.test(token)) return 'code-token--string';
  if (/^(?:\/\/|#)/.test(token)) return 'code-token--comment';
  if (/^\d/.test(token)) return 'code-token--number';
  return 'code-token--keyword';
};

export const highlightCode = (code: string, language?: string): string => {
  const normalizedLanguage = language?.trim().toLowerCase();
  if (!normalizedLanguage || !highlightedLanguages.has(normalizedLanguage)) {
    return escapeHtml(code);
  }

  let cursor = 0;
  let result = '';
  for (const match of code.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    result += escapeHtml(code.slice(cursor, index));
    const token = match[0];
    result += `<span class="code-token ${tokenClass(token)}">${escapeHtml(token)}</span>`;
    cursor = index + token.length;
  }
  return result + escapeHtml(code.slice(cursor));
};

const isLocalMarkdownLink = (href: string): boolean =>
  !/^[a-z][a-z\d+.-]*:/i.test(href) &&
  !href.startsWith('//') &&
  /\.(md|markdown)(?:#.*)?(?:\?.*)?$/i.test(href);

export const renderMarkdownPreview = (
  content: string,
  options: {
    documentPath?: string;
    imageSources?: Readonly<Record<string, string>>;
  } = {},
): string => {
  const renderer = new marked.Renderer();
  renderer.code = ({ text, lang }) => {
    const normalizedLanguage = lang?.trim().toLowerCase();
    if (normalizedLanguage === 'mermaid') {
      return `<div class="mermaid-block"><div class="mermaid-diagram">Mermaid 미리보기를 준비하고 있습니다.</div><details><summary>Mermaid 원문</summary><pre><code>${escapeHtml(text)}</code></pre></details></div>`;
    }
    const languageClass = normalizedLanguage
      ? ` class="language-${escapeHtml(normalizedLanguage)}"`
      : '';
    return `<pre><code${languageClass}>${highlightCode(text, normalizedLanguage)}</code></pre>`;
  };
  const parsed = marked.parse(content, {
    async: false,
    renderer,
  });
  const sanitized = createDOMPurify(window).sanitize(parsed, {
    ALLOWED_TAGS: [
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'blockquote',
      'pre',
      'code',
      'span',
      'div',
      'details',
      'summary',
      'strong',
      'em',
      'del',
      'a',
      'img',
      'br',
      'hr',
    ],
    ALLOWED_ATTR: ['href', 'title', 'src', 'alt', 'class'],
    ALLOW_DATA_ATTR: false,
  });
  const template = document.createElement('template');
  template.innerHTML = sanitized;
  for (const anchor of template.content.querySelectorAll('a')) {
    const href = anchor.getAttribute('href') ?? '';
    if (isLocalMarkdownLink(href)) {
      anchor.setAttribute('href', '#');
      anchor.setAttribute('data-dock-document', href.split(/[?#]/, 1)[0]);
    } else if (/^https?:/i.test(href)) {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noreferrer noopener');
    } else {
      anchor.removeAttribute('href');
    }
  }
  for (const image of template.content.querySelectorAll('img')) {
    const source = image.getAttribute('src') ?? '';
    const assetPath = options.documentPath
      ? normalizeWorkspaceAssetPath(options.documentPath, source)
      : undefined;
    const dataUrl = assetPath ? options.imageSources?.[assetPath] : undefined;
    if (!assetPath || !dataUrl) {
      image.remove();
      continue;
    }
    image.setAttribute('src', dataUrl);
  }
  return template.innerHTML;
};
