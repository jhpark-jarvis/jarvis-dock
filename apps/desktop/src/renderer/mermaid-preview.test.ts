// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { renderMermaidDiagram } from './mermaid-preview';

describe('renderMermaidDiagram', () => {
  beforeEach(() => {
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        width: 100,
        height: 24,
        top: 0,
        right: 100,
        bottom: 24,
        left: 0,
      }),
    });
    Object.defineProperty(SVGElement.prototype, 'getComputedTextLength', {
      configurable: true,
      value: () => 80,
    });
  });

  it('renders a Mermaid flowchart as sanitized SVG', async () => {
    const svg = await renderMermaidDiagram(
      'flowchart LR\n  A[Start] --> B[Finish]',
    );

    expect(svg).toContain('<svg');
    expect(svg).toContain('class="nodes"');
    expect(svg).toContain('flowchart-link');
    expect(svg).not.toContain('<style');
    expect(svg).not.toContain(' style=');
    expect(svg).not.toContain('<script');
  });

  it('rejects invalid Mermaid syntax', async () => {
    await expect(renderMermaidDiagram('this is not Mermaid')).rejects.toThrow();
  });
});
