import createDOMPurify from 'dompurify';
import { marked } from 'marked';
import { normalizeWorkspaceAssetPath } from '../shared/image-assets';

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
  const parsed = marked.parse(content, { async: false });
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
      'strong',
      'em',
      'del',
      'a',
      'img',
      'br',
      'hr',
    ],
    ALLOWED_ATTR: ['href', 'title', 'src', 'alt'],
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
