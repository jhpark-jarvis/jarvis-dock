import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RelativeMarkdownPathSchema } from '../shared/ipc';
import {
  createDocument,
  createWorkspaceStore,
  listMarkdownFiles,
  listWorkspaceEntries,
  readDocument,
  registerWorkspace,
  resolveWorkspacePath,
  writeDocument,
} from './workspace-service';

const makeTempDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-dock-'));

describe('workspace service', () => {
  it('registers a workspace and lists only markdown files', async () => {
    const root = await makeTempDir();
    await fs.mkdir(path.join(root, 'notes'));
    await fs.writeFile(path.join(root, 'notes', 'one.md'), '# One');
    await fs.writeFile(path.join(root, 'notes', 'two.txt'), 'ignore');
    const store = createWorkspaceStore();

    const summary = await registerWorkspace(store, root);
    await expect(listMarkdownFiles(root)).resolves.toEqual([
      { relativePath: 'notes/one.md', displayName: 'one.md' },
    ]);
    expect(summary.displayName).toBe(path.basename(root));
    expect(store.get(summary.workspaceId)).toBe(await fs.realpath(root));
  });

  it('lists visible files and folders for the Explorer', async () => {
    const root = await makeTempDir();
    await fs.mkdir(path.join(root, 'docs', 'nested'), { recursive: true });
    await fs.writeFile(path.join(root, 'docs', 'nested', 'note.md'), '# Note');
    await fs.writeFile(path.join(root, 'readme.txt'), 'readme');
    await fs.writeFile(path.join(root, '.hidden.md'), 'hidden');

    await expect(listWorkspaceEntries(root)).resolves.toEqual([
      { relativePath: 'docs', displayName: 'docs', kind: 'directory' },
      {
        relativePath: 'docs/nested',
        displayName: 'nested',
        kind: 'directory',
      },
      {
        relativePath: 'docs/nested/note.md',
        displayName: 'note.md',
        kind: 'file',
      },
      { relativePath: 'readme.txt', displayName: 'readme.txt', kind: 'file' },
    ]);
  });

  it('skips dependency and generated directories during workspace scans', async () => {
    const root = await makeTempDir();
    await fs.mkdir(path.join(root, 'docs'));
    await fs.mkdir(path.join(root, 'node_modules', 'package'), {
      recursive: true,
    });
    await fs.mkdir(path.join(root, 'dist'), { recursive: true });
    await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
    await fs.mkdir(path.join(root, '.vite'), { recursive: true });
    await fs.writeFile(path.join(root, 'docs', 'guide.md'), '# Guide');
    await fs.writeFile(
      path.join(root, 'node_modules', 'package', 'index.md'),
      '# Dependency',
    );
    await fs.writeFile(path.join(root, 'dist', 'generated.md'), '# Generated');
    await fs.writeFile(
      path.join(root, 'test-results', 'generated.md'),
      '# Test result',
    );
    await fs.writeFile(path.join(root, '.vite', 'generated.md'), '# Vite');

    await expect(listMarkdownFiles(root)).resolves.toEqual([
      { relativePath: 'docs/guide.md', displayName: 'guide.md' },
    ]);
    await expect(listWorkspaceEntries(root)).resolves.toEqual([
      { relativePath: 'docs', displayName: 'docs', kind: 'directory' },
      { relativePath: 'docs/guide.md', displayName: 'guide.md', kind: 'file' },
    ]);
  });

  it('rejects absolute and parent paths at the shared contract boundary', () => {
    expect(RelativeMarkdownPathSchema.safeParse('../outside.md').success).toBe(
      false,
    );
    expect(RelativeMarkdownPathSchema.safeParse('C:/outside.md').success).toBe(
      false,
    );
    expect(RelativeMarkdownPathSchema.safeParse('/outside.md').success).toBe(
      false,
    );
    expect(RelativeMarkdownPathSchema.safeParse('notes/today.md').success).toBe(
      true,
    );
  });

  it('preserves the existing document when a later write is not completed', async () => {
    const root = await makeTempDir();
    const file = path.join(root, 'note.md');
    await fs.writeFile(file, 'original', 'utf8');
    await writeDocument(file, 'note.md', 'updated');
    await expect(readDocument(file, 'note.md')).resolves.toEqual({
      relativePath: 'note.md',
      content: 'updated',
      encoding: 'utf-8',
      revision: expect.any(String),
    });
  });

  it('creates a new document once and rejects a duplicate', async () => {
    const root = await makeTempDir();
    const file = path.join(root, 'new.md');
    await expect(createDocument(file, 'new.md')).resolves.toMatchObject({
      relativePath: 'new.md',
      bytesWritten: 0,
      savedAt: expect.any(String),
    });
    await expect(createDocument(file, 'new.md')).rejects.toMatchObject({
      code: 'EEXIST',
    });
  });

  it('does not resolve a path outside the selected workspace', async () => {
    const root = await makeTempDir();
    const store = createWorkspaceStore();
    const summary = await registerWorkspace(store, root);
    await expect(
      resolveWorkspacePath(store, summary.workspaceId, '../outside.md', false),
    ).resolves.toBeUndefined();
  });
});
