import createDOMPurify from 'dompurify';
import mermaid from 'mermaid';

let initialized = false;
let renderSequence = 0;

const ensureMermaidInitialized = (): void => {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'dark',
    maxTextSize: 10000,
    htmlLabels: false,
    flowchart: {
      htmlLabels: false,
      nodeSpacing: 80,
      rankSpacing: 110,
      padding: 24,
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
  template.content.querySelectorAll('style, [style]').forEach((element) => {
    if (element.tagName.toLowerCase() === 'style') {
      element.remove();
    } else {
      element.removeAttribute('style');
    }
  });
  return createDOMPurify(window).sanitize(template.innerHTML, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ALLOW_DATA_ATTR: false,
  });
};
