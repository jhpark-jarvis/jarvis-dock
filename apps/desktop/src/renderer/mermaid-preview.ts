import createDOMPurify from 'dompurify';
import mermaid from 'mermaid';

let initialized = false;
let renderSequence = 0;

const SAFE_INLINE_STYLE_PROPERTIES = new Set([
  'alignment-baseline',
  'display',
  'dominant-baseline',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'height',
  'text-anchor',
  'text-align',
  'text-decoration',
  'vertical-align',
  'width',
]);

const SAFE_INLINE_STYLE_VALUE = /^[#%(),.'"+\-\s\w/]+$/i;

const sanitizeInlineStyle = (style: string): string =>
  style
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .flatMap((declaration) => {
      const separator = declaration.indexOf(':');
      if (separator < 0) return [];

      const property = declaration.slice(0, separator).trim().toLowerCase();
      const value = declaration.slice(separator + 1).trim();
      if (
        !SAFE_INLINE_STYLE_PROPERTIES.has(property) ||
        !SAFE_INLINE_STYLE_VALUE.test(value) ||
        /(?:url|expression|javascript|var\s*\()/i.test(value)
      ) {
        return [];
      }

      return [`${property}:${value}`];
    })
    .join(';');

const ensureMermaidInitialized = (): void => {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'dark',
    maxTextSize: 10000,
    htmlLabels: false,
    flowchart: {
      nodeSpacing: 80,
      rankSpacing: 110,
      padding: 24,
    },
    c4: {
      useMaxWidth: false,
      diagramMarginX: 40,
      diagramMarginY: 20,
      c4ShapeMargin: 160,
      c4ShapePadding: 28,
      width: 240,
      height: 90,
      c4ShapeInRow: 3,
      wrap: true,
      wrapPadding: 12,
      personFontFamily: 'Pretendard, Segoe UI, sans-serif',
      external_personFontFamily: 'Pretendard, Segoe UI, sans-serif',
      systemFontFamily: 'Pretendard, Segoe UI, sans-serif',
      external_systemFontFamily: 'Pretendard, Segoe UI, sans-serif',
      containerFontFamily: 'Pretendard, Segoe UI, sans-serif',
      external_containerFontFamily: 'Pretendard, Segoe UI, sans-serif',
      componentFontFamily: 'Pretendard, Segoe UI, sans-serif',
      external_componentFontFamily: 'Pretendard, Segoe UI, sans-serif',
      boundaryFontFamily: 'Pretendard, Segoe UI, sans-serif',
      messageFontFamily: 'Pretendard, Segoe UI, sans-serif',
      messageFontSize: 13,
      messageFontWeight: '600',
    },
  });
  initialized = true;
};

export const renderMermaidDiagram = async (source: string): Promise<string> => {
  ensureMermaidInitialized();
  const { svg } = await mermaid.render(
    `dock-mermaid-${renderSequence++}`,
    source,
  );
  const template = document.createElement('template');
  template.innerHTML = svg;
  if (
    /^\s*C4(?:Context|Container|Component|Dynamic|Deployment)\b/i.test(source)
  ) {
    template.content.querySelector('svg')?.classList.add('mermaid-c4-svg');
  }
  template.content
    .querySelectorAll('style')
    .forEach((element) => element.remove());
  template.content.querySelectorAll('[style]').forEach((element) => {
    const sanitizedStyle = sanitizeInlineStyle(
      element.getAttribute('style') ?? '',
    );
    if (sanitizedStyle) {
      element.setAttribute('style', sanitizedStyle);
    } else {
      element.removeAttribute('style');
    }
  });
  return createDOMPurify(window).sanitize(template.innerHTML, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ALLOW_DATA_ATTR: false,
  });
};
