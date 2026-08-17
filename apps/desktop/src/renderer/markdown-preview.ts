import createDOMPurify from 'dompurify';
import { marked } from 'marked';

const isLocalMarkdownLink = (href: string): boolean =>
  !/^[a-z][a-z\d+.-]*:/i.test(href) &&
  !href.startsWith('//') &&
  /\.(md|markdown)(?:#.*)?(?:\?.*)?$/i.test(href);

export const renderMarkdownPreview = (content: string): string => {
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
      'br',
      'hr',
    ],
    ALLOWED_ATTR: ['href', 'title'],
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
  return template.innerHTML;
};
