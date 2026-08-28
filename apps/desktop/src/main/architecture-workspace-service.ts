import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  ArchitectureCheckProjectResultEnvelope,
  ArchitectureCreateAdrRequest,
  ArchitectureCreateAdrResultEnvelope,
  ArchitectureCreateProjectRequest,
} from '../shared/ipc';
import { createDocumentWithContent, writeDocument } from './workspace-service';

export const ARCHITECTURE_DOCUMENTS = [
  'docs/architecture/arc42.md',
  'docs/architecture/c4-context.md',
  'docs/architecture/c4-container.md',
  'docs/architecture/c4-component.md',
  'docs/adr/README.md',
  'docs/adr/0001-initial-architecture.md',
] as const;

type ArchitectureDocument = {
  relativePath: (typeof ARCHITECTURE_DOCUMENTS)[number];
  content: string;
};

export class ArchitectureWorkspaceConflictError extends Error {
  constructor(readonly paths: string[]) {
    super('Architecture workspace files already exist.');
    this.name = 'ArchitectureWorkspaceConflictError';
  }
}

const oneLine = (value: string): string => value.replace(/\s+/g, ' ').trim();

const renderDocuments = (
  request: ArchitectureCreateProjectRequest,
): ArchitectureDocument[] => {
  const projectName = oneLine(request.projectName);
  const purpose = oneLine(request.purpose);
  const techStack =
    oneLine(request.techStack ?? '') || '기술 스택을 기록하세요.';

  return [
    {
      relativePath: ARCHITECTURE_DOCUMENTS[0],
      content: `# ${projectName} 아키텍처

> 이 문서는 arc42 구조를 기준으로 작성하는 프로젝트 아키텍처 초안입니다.

## 1. 소개와 목표

### 1.1 요구사항 개요

${purpose}

### 1.2 품질 목표

| 우선순위 | 품질 목표 | 측정 기준 |
|---|---|---|
| 1 | 명확성 | 주요 구조와 결정이 문서에서 추적 가능 |
| 2 | 변경 용이성 | 변경 이유와 영향 범위를 ADR로 기록 |
| 3 | 검증 가능성 | 핵심 흐름에 테스트와 운영 확인 기준 존재 |

## 2. 제약사항

- 주요 기술 스택: ${techStack}
- 문서와 결정은 저장소의 Markdown으로 관리합니다.
- 구현 전 중요한 구조 변경은 ADR로 기록합니다.

## 3. 컨텍스트와 범위

시스템 경계, 사용자, 외부 시스템은 [C4 Context](./c4-context.md)에서 관리합니다.

## 4. 솔루션 전략

서비스 경계, 런타임 흐름, 데이터 흐름을 [C4 Container](./c4-container.md) 문서와 함께 구체화합니다.

## 5. 빌딩 블록 뷰

Context·Container·Component 수준의 구조를 각각의 C4 문서에서 관리합니다.

## 6. 런타임 뷰

주요 사용자 여정과 시스템 간 상호작용을 Mermaid 시퀀스 다이어그램으로 기록합니다.

## 7. 배포 뷰

실행 환경, 배포 단위, 네트워크 경계를 기록합니다.

## 8. 횡단 관심사

보안, 오류 처리, 로깅, 관측성, 데이터 보존 정책을 기록합니다.

## 9. 아키텍처 결정

중요한 결정은 [ADR index](../adr/README.md)와 개별 ADR에 기록합니다.

## 10. 품질 요구사항

정량화할 수 있는 성능·보안·가용성·유지보수성 기준을 기록합니다.

## 11. 위험과 기술 부채

검증이 필요한 가정, 알려진 위험, 의도적으로 남긴 기술 부채를 기록합니다.

## 12. 용어

| 용어 | 정의 |
|---|---|
| 프로젝트 | ${projectName} |
| document workspace | 이 문서 세트를 저장한 로컬 폴더 |
`,
    },
    {
      relativePath: ARCHITECTURE_DOCUMENTS[1],
      content: `# ${projectName} C4 Context

## 목적

${purpose}

## 시스템 컨텍스트

\`\`\`mermaid
C4Context
title ${projectName} 시스템 컨텍스트

Person(user, "사용자", "프로젝트를 사용하고 문서를 검토하는 사람")
System(system, "${projectName}", "${purpose}")
System_Ext(git, "Git 저장소", "소스 코드와 Markdown 이력")

Rel(user, system, "사용")
Rel(system, git, "문서와 변경 이력 관리")
\`\`\`

## 확인할 질문

- 시스템의 실제 사용자와 책임은 누구인가?
- 외부 시스템과의 데이터 교환은 무엇인가?
- 시스템 경계 밖에 두어야 할 책임은 무엇인가?
`,
    },
    {
      relativePath: ARCHITECTURE_DOCUMENTS[2],
      content: `# ${projectName} C4 Container

## 목적

Context 수준의 시스템을 실행 가능한 책임 단위로 나눕니다.

## Container 뷰

\`\`\`mermaid
C4Container
title ${projectName} Container 뷰

Person(user, "사용자")
System_Boundary(boundary, "${projectName}") {
  Container(app, "Application", "주요 사용자 흐름", "${techStack}")
  Container(docs, "Documentation Workspace", "프로젝트 문서와 결정", "Markdown")
}
System_Ext(git, "Git 저장소")

Rel(user, app, "기능 사용")
Rel(app, docs, "문서 읽기·쓰기")
Rel(docs, git, "변경 이력 관리")
\`\`\`

## Container 책임

| Container | 책임 | 기술 | 다음 질문 |
|---|---|---|---|
| Application | 사용자 요청과 핵심 흐름 처리 | ${techStack} | 어떤 경계를 유지해야 하는가? |
| Documentation Workspace | arc42·C4·ADR 원본 보관 | Markdown | 어떤 문서를 단일 진실 공급원으로 볼 것인가? |

## 설계 메모

구현 과정에서 책임이 더 세분화되면 Component 수준 문서와 ADR을 추가합니다.
`,
    },
    {
      relativePath: ARCHITECTURE_DOCUMENTS[3],
      content: `# ${projectName} C4 Component

## 목적

Container 내부의 책임과 주요 컴포넌트 간 협력을 구체화합니다.

## Component 뷰

\`\`\`mermaid
C4Component
title ${projectName} Application Component 뷰

Container_Boundary(app, "Application") {
  Component(entry, "Entry Point", "사용자 요청을 받는 진입점")
  Component(core, "Core Flow", "핵심 사용자 흐름을 조정하는 컴포넌트")
  Component(storage, "Document Storage", "문서와 결정을 저장하는 컴포넌트")
}

Rel(entry, core, "요청 전달")
Rel(core, storage, "문서 읽기·쓰기")
\`\`\`

## Component 책임

| Component | 책임 | 검증 방법 |
|---|---|---|
| Entry Point | 사용자 요청과 입력 경계 처리 | 입력 검증 테스트 |
| Core Flow | 도메인 흐름과 책임 조정 | 핵심 사용자 여정 E2E |
| Document Storage | 문서와 결정의 영속화 | 저장·재시작 회귀 테스트 |

## 설계 메모

실제 코드 모듈과 책임이 달라지면 이 문서와 관련 ADR을 함께 갱신합니다.
`,
    },
    {
      relativePath: ARCHITECTURE_DOCUMENTS[4],
      content: `# Architecture Decision Records

이 디렉터리는 ${projectName}의 중요한 기술 결정을 기록합니다.

## Index

| ADR | 상태 | 결정 |
|---|---|---|
| [0001-initial-architecture.md](./0001-initial-architecture.md) | Accepted | 프로젝트 초기 아키텍처 문서 세트 |

## 작성 규칙

1. 한 ADR은 하나의 결정을 다룹니다.
2. 결정의 배경, 선택지, 결과를 함께 기록합니다.
3. 결정이 바뀌면 기존 ADR을 삭제하지 않고 새 ADR로 대체합니다.
`,
    },
    {
      relativePath: ARCHITECTURE_DOCUMENTS[5],
      content: `# ADR-0001: ${projectName} 초기 아키텍처 문서 세트

## 상태

Accepted

## 배경

${purpose}

프로젝트의 구조와 결정이 구현과 함께 흔들리지 않도록 arc42, C4, ADR 문서를 저장소에서 함께 관리할 필요가 있습니다.

## 결정

- arc42를 전체 아키텍처 설명의 기본 목차로 사용합니다.
- C4 Context·Container·Component를 Mermaid가 포함된 Markdown으로 관리합니다.
- 중요한 설계 변경은 ADR로 기록합니다.
- 주요 기술 스택은 ${techStack}입니다.

## 결과

- 문서 구조를 먼저 검토한 뒤 구현을 시작할 수 있습니다.
- 구조 변경의 이유와 영향 범위를 추적할 수 있습니다.
- Component 수준의 상세화와 자동화는 후속 ADR에서 결정합니다.
`,
    },
  ];
};

const comparablePath = (value: string): string => {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

const isInside = (root: string, candidate: string): boolean => {
  const relative = path.relative(
    comparablePath(root),
    comparablePath(candidate),
  );
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
};

export const createArchitectureDocuments = async (
  rootPath: string,
  request: ArchitectureCreateProjectRequest,
): Promise<{
  ok: true;
  value: {
    projectName: string;
    files: Array<{
      relativePath: (typeof ARCHITECTURE_DOCUMENTS)[number];
      bytesWritten: number;
    }>;
  };
}> => {
  const documents = renderDocuments(request);
  const root = await fs.realpath(rootPath);
  const absolutePaths = documents.map((document) =>
    path.resolve(root, document.relativePath),
  );
  if (absolutePaths.some((absolutePath) => !isInside(root, absolutePath))) {
    throw new Error('Architecture document path is outside the workspace.');
  }

  const conflicts: string[] = [];
  for (const [index, absolutePath] of absolutePaths.entries()) {
    try {
      await fs.lstat(absolutePath);
      conflicts.push(documents[index].relativePath);
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause;
    }
  }
  if (conflicts.length > 0) {
    throw new ArchitectureWorkspaceConflictError(conflicts);
  }

  const created: string[] = [];
  try {
    for (const [index, document] of documents.entries()) {
      const absolutePath = absolutePaths[index];
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      const realParent = await fs.realpath(path.dirname(absolutePath));
      if (!isInside(root, realParent)) {
        throw new Error(
          'Architecture document parent is outside the workspace.',
        );
      }
      await createDocumentWithContent(
        absolutePath,
        document.relativePath,
        document.content,
      );
      created.push(absolutePath);
    }
  } catch (cause) {
    await Promise.all(
      created.map((absolutePath) => fs.rm(absolutePath, { force: true })),
    );
    throw cause;
  }

  return {
    ok: true,
    value: {
      projectName: oneLine(request.projectName),
      files: documents.map((document) => ({
        relativePath: document.relativePath,
        bytesWritten: Buffer.byteLength(document.content, 'utf8'),
      })),
    },
  };
};

const requiredContent = new Map<string, string[]>([
  [
    ARCHITECTURE_DOCUMENTS[0],
    [
      '## 1. 소개와 목표',
      './c4-context.md',
      './c4-container.md',
      '../adr/README.md',
    ],
  ],
  [ARCHITECTURE_DOCUMENTS[1], ['```mermaid', 'C4Context']],
  [ARCHITECTURE_DOCUMENTS[2], ['```mermaid', 'C4Container']],
  [ARCHITECTURE_DOCUMENTS[3], ['```mermaid', 'C4Component']],
  [ARCHITECTURE_DOCUMENTS[4], ['./0001-initial-architecture.md', '## Index']],
  [ARCHITECTURE_DOCUMENTS[5], ['## 상태', '## 결정']],
]);

export const checkArchitectureDocuments = async (
  rootPath: string,
): Promise<ArchitectureCheckProjectResultEnvelope> => {
  const root = await fs.realpath(rootPath);
  const files = [];
  for (const relativePath of ARCHITECTURE_DOCUMENTS) {
    const absolutePath = path.resolve(root, relativePath);
    const issues: string[] = [];
    if (!isInside(root, absolutePath)) {
      files.push({
        relativePath,
        status: 'invalid' as const,
        issues: ['경로가 document workspace 밖을 가리킵니다.'],
      });
      continue;
    }
    let content = '';
    try {
      const stat = await fs.lstat(absolutePath);
      if (!stat.isFile()) {
        files.push({
          relativePath,
          status: 'invalid' as const,
          issues: ['파일이 아닌 항목입니다.'],
        });
        continue;
      }
      content = await fs.readFile(absolutePath, 'utf8');
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
        files.push({
          relativePath,
          status: 'missing' as const,
          issues: ['필수 문서가 없습니다.'],
        });
        continue;
      }
      files.push({
        relativePath,
        status: 'invalid' as const,
        issues: ['문서를 읽지 못했습니다.'],
      });
      continue;
    }
    for (const marker of requiredContent.get(relativePath) ?? []) {
      if (!content.includes(marker)) {
        issues.push(`필수 항목이 없습니다: ${marker}`);
      }
    }
    files.push({
      relativePath,
      status: issues.length === 0 ? ('present' as const) : ('invalid' as const),
      issues,
    });
  }
  return {
    ok: true,
    value: {
      passed: files.every((file) => file.status === 'present'),
      files,
    },
  };
};

const adrSlug = (title: string): string =>
  oneLine(title)
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .toLowerCase() || 'decision';

const tableText = (value: string): string =>
  oneLine(value).replace(/\|/g, '\\|');

const readAdrNumber = (name: string): number | undefined => {
  const match = /^(\d{4})-[^/]+\.md$/i.exec(name);
  if (!match) return undefined;
  const number = Number(match[1]);
  return number > 0 ? number : undefined;
};

const appendAdrIndexEntry = (content: string, entry: string): string => {
  const indexMatch = /^## Index\s*$/m.exec(content);
  if (!indexMatch || indexMatch.index === undefined) {
    return `${content.trimEnd()}\n\n## Index\n\n| ADR | 상태 | 결정 |\n|---|---|---|\n${entry}\n`;
  }
  const sectionStart = indexMatch.index + indexMatch[0].length;
  const nextHeading = content.indexOf('\n## ', sectionStart);
  const insertionPoint = nextHeading >= 0 ? nextHeading : content.length;
  const before = content.slice(0, insertionPoint).trimEnd();
  const after = content.slice(insertionPoint).trimStart();
  return `${before}\n${entry}\n\n${after}`;
};

const createAdrMarkdown = (
  request: ArchitectureCreateAdrRequest,
  adrNumber: number,
): string => {
  const title = oneLine(request.title);
  return `# ADR-${String(adrNumber).padStart(4, '0')}: ${title}

## 상태

${request.status}

## 배경

${request.context.trim()}

## 결정

${request.decision.trim()}

## 결과

${request.consequences.trim()}
`;
};

export const createAdrDocument = async (
  rootPath: string,
  request: ArchitectureCreateAdrRequest,
): Promise<Extract<ArchitectureCreateAdrResultEnvelope, { ok: true }>> => {
  const root = await fs.realpath(rootPath);
  const adrDirectory = path.resolve(root, 'docs/adr');
  await fs.mkdir(adrDirectory, { recursive: true });
  const realAdrDirectory = await fs.realpath(adrDirectory);
  if (!isInside(root, realAdrDirectory)) {
    throw new Error('The ADR directory is outside the document workspace.');
  }

  const entries = await fs.readdir(realAdrDirectory, { withFileTypes: true });
  const numbers = entries
    .filter((entry) => entry.isFile())
    .map((entry) => readAdrNumber(entry.name))
    .filter((number): number is number => number !== undefined);
  const adrNumber = Math.max(0, ...numbers) + 1;
  if (adrNumber > 9999) throw new Error('The ADR number limit was exceeded.');

  const fileName = `${String(adrNumber).padStart(4, '0')}-${adrSlug(request.title)}.md`;
  const relativePath = `docs/adr/${fileName}`;
  const absolutePath = path.resolve(root, relativePath);
  if (!isInside(root, absolutePath)) {
    throw new Error('The ADR path is outside the document workspace.');
  }
  try {
    await fs.lstat(absolutePath);
    throw new ArchitectureWorkspaceConflictError([relativePath]);
  } catch (cause) {
    if (cause instanceof ArchitectureWorkspaceConflictError) throw cause;
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause;
  }

  const indexPath = path.join(realAdrDirectory, 'README.md');
  let indexContent = '';
  let indexExists = false;
  try {
    const indexStat = await fs.lstat(indexPath);
    if (!indexStat.isFile())
      throw new Error('The ADR index is not a regular file.');
    indexContent = await fs.readFile(indexPath, 'utf8');
    indexExists = true;
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause;
  }

  const entry = `| [${fileName}](./${fileName}) | ${request.status} | ${tableText(
    request.title,
  )} |`;
  const nextIndexContent = appendAdrIndexEntry(indexContent, entry);
  const createdPath = createAdrMarkdown(request, adrNumber);
  await createDocumentWithContent(absolutePath, relativePath, createdPath);
  try {
    if (indexExists) {
      await writeDocument(indexPath, 'docs/adr/README.md', nextIndexContent);
    } else {
      await createDocumentWithContent(
        indexPath,
        'docs/adr/README.md',
        nextIndexContent,
      );
    }
  } catch (cause) {
    await fs.rm(absolutePath, { force: true });
    throw cause;
  }

  return {
    ok: true,
    value: {
      relativePath,
      adrNumber,
      title: oneLine(request.title),
      status: request.status,
      indexUpdated: true,
    },
  };
};
