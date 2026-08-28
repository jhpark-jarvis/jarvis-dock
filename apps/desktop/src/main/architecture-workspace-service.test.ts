import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ARCHITECTURE_DOCUMENTS,
  ArchitectureWorkspaceConflictError,
  checkArchitectureDocuments,
  createArchitectureDocuments,
} from './architecture-workspace-service';

const request = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  projectName: 'Dock',
  purpose: '로컬 Markdown 기술 문서를 작성하고 관리합니다.',
  techStack: 'Electron, React, TypeScript',
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
});
