import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ARCHITECTURE_DOCUMENTS,
  ArchitectureWorkspaceConflictError,
  checkArchitectureDocuments,
  createAdrDocument,
  createArchitectureDocuments,
} from './architecture-workspace-service';

const request = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  projectName: 'Dock',
  purpose: '로컬 Markdown 기술 문서를 작성하고 관리합니다.',
  techStack: 'Electron, React, TypeScript',
};

const adrRequest = {
  workspaceId: request.workspaceId,
  title: 'ADR 작성 흐름 추가',
  status: 'Accepted' as const,
  context: '중요한 구조 결정을 채팅에만 남기면 추적하기 어렵습니다.',
  decision: 'Dock에서 번호가 붙은 ADR을 생성하고 index를 갱신합니다.',
  consequences: '결정의 배경과 결과를 문서 workspace 안에서 함께 관리합니다.',
};

describe('architecture workspace service', () => {
  it('creates the deterministic arc42, C4, and ADR document set', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'jarvis-dock-architecture-workspace-'),
    );

    try {
      const result = await createArchitectureDocuments(root, request);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.files.map((file) => file.relativePath)).toEqual(
          ARCHITECTURE_DOCUMENTS,
        );
      }
      await expect(
        fs.readFile(path.join(root, 'docs/architecture/c4-context.md'), 'utf8'),
      ).resolves.toContain('C4Context');
      await expect(
        fs.readFile(path.join(root, 'docs/architecture/arc42.md'), 'utf8'),
      ).resolves.toContain('로컬 Markdown 기술 문서를 작성하고 관리합니다.');
      await expect(checkArchitectureDocuments(root)).resolves.toMatchObject({
        ok: true,
        value: { passed: true },
      });
      await fs.rm(path.join(root, 'docs/architecture/c4-container.md'));
      await expect(checkArchitectureDocuments(root)).resolves.toMatchObject({
        ok: true,
        value: {
          passed: false,
          files: expect.arrayContaining([
            expect.objectContaining({
              relativePath: 'docs/architecture/c4-container.md',
              status: 'missing',
            }),
          ]),
        },
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('refuses the whole document set when any target already exists', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'jarvis-dock-architecture-conflict-'),
    );
    const conflictPath = path.join(root, ARCHITECTURE_DOCUMENTS[0]);
    await fs.mkdir(path.dirname(conflictPath), { recursive: true });
    await fs.writeFile(conflictPath, '# Existing', 'utf8');

    try {
      await expect(
        createArchitectureDocuments(root, request),
      ).rejects.toBeInstanceOf(ArchitectureWorkspaceConflictError);
      await expect(
        fs.readdir(path.join(root, 'docs/architecture')),
      ).resolves.toEqual(['arc42.md']);
      await expect(
        fs.readdir(path.join(root, 'docs/adr')),
      ).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('creates a numbered ADR and an index when the ADR directory is new', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'jarvis-dock-adr-create-'),
    );

    try {
      await expect(createAdrDocument(root, adrRequest)).resolves.toMatchObject({
        ok: true,
        value: {
          relativePath: 'docs/adr/0001-adr-작성-흐름-추가.md',
          adrNumber: 1,
          title: adrRequest.title,
          status: 'Accepted',
          indexUpdated: true,
        },
      });
      await expect(
        fs.readFile(
          path.join(root, 'docs/adr/0001-adr-작성-흐름-추가.md'),
          'utf8',
        ),
      ).resolves.toContain('# ADR-0001: ADR 작성 흐름 추가');
      await expect(
        fs.readFile(path.join(root, 'docs/adr/README.md'), 'utf8'),
      ).resolves.toContain(
        '| [0001-adr-작성-흐름-추가.md](./0001-adr-작성-흐름-추가.md) | Accepted | ADR 작성 흐름 추가 |',
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('increments the ADR number and preserves existing decisions', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'jarvis-dock-adr-sequence-'),
    );

    try {
      await createAdrDocument(root, adrRequest);
      const next = await createAdrDocument(root, {
        ...adrRequest,
        title: '두 번째 결정',
        status: 'Proposed',
      });

      expect(next.value.relativePath).toBe('docs/adr/0002-두-번째-결정.md');
      const index = await fs.readFile(
        path.join(root, 'docs/adr/README.md'),
        'utf8',
      );
      expect(index).toContain('0001-adr-작성-흐름-추가.md');
      expect(index).toContain('0002-두-번째-결정.md');
      await expect(
        fs.readFile(
          path.join(root, 'docs/adr/0001-adr-작성-흐름-추가.md'),
          'utf8',
        ),
      ).resolves.toContain('## 결과');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('does not overwrite a pre-existing ADR while creating the next one', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'jarvis-dock-adr-conflict-'),
    );
    const target = path.join(root, 'docs/adr/0001-initial.md');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, '# Existing ADR', 'utf8');

    try {
      await expect(createAdrDocument(root, adrRequest)).resolves.toMatchObject({
        ok: true,
        value: { relativePath: 'docs/adr/0002-adr-작성-흐름-추가.md' },
      });
      await expect(fs.readFile(target, 'utf8')).resolves.toBe('# Existing ADR');
      await expect(
        fs.readFile(path.join(root, 'docs/adr/README.md'), 'utf8'),
      ).resolves.toContain('0002-adr-작성-흐름-추가.md');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
