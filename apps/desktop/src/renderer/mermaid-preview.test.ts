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
    expect(svg).not.toContain('<script');
    expect(svg).not.toMatch(
      /style="[^"]*(?:url|expression|javascript|var\s*\()/i,
    );
  });

  it('renders a Mermaid C4 context diagram as sanitized SVG', async () => {
    const svg = await renderMermaidDiagram(
      'C4Context\ntitle Demo\nPerson(user, "User")\nSystem(system, "System")\nRel(user, system, "uses")',
    );

    expect(svg).toContain('<svg');
    expect(svg).toContain('mermaid-c4-svg');
    expect(svg).toContain('c4-shape');
  });

  it('renders Mermaid C4 container and component diagrams as sanitized SVG', async () => {
    for (const source of [
      'C4Container\ntitle Demo\nPerson(user, "User")\nSystem_Boundary(boundary, "Demo") {\n  Container(app, "Application", "Main flow", "Electron")\n}\nRel(user, app, "uses")',
      'C4Component\ntitle Demo\nContainer_Boundary(app, "Application") {\n  Component(entry, "Entry Point", "Receives requests")\n}\nRel(entry, entry, "loops")',
    ]) {
      const svg = await renderMermaidDiagram(source);
      expect(svg).toContain('<svg');
    }
  });

  it('renders the generated Korean C4 context template', async () => {
    const svg = await renderMermaidDiagram(
      'C4Context\ntitle 1 시스템 컨텍스트\n\nPerson(user, "사용자", "프로젝트를 사용하고 문서를 검토하는 사람")\nSystem(system, "1", "2")\nSystem_Ext(git, "Git 저장소", "소스 코드와 Markdown 이력")\n\nRel(user, system, "사용")\nRel(system, git, "문서와 변경 이력 관리")',
    );

    expect(svg).toContain('<svg');
  });

  it('rejects invalid Mermaid syntax', async () => {
    await expect(renderMermaidDiagram('this is not Mermaid')).rejects.toThrow();
  });
});
