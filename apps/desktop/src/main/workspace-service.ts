import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  WorkspaceFile,
  WorkspaceSummary,
  WriteResult,
  DocumentData,
} from '../shared/ipc';

export type WorkspaceStore = Map<string, string>;

export const createWorkspaceStore = (): WorkspaceStore => new Map();

const comparablePath = (value: string): string => {
  const resolved = path.resolve(value);
  if (process.platform !== 'win32') return resolved;
  return resolved
    .replace(/^\\\\\?\\UNC\\/i, '\\\\')
    .replace(/^\\\\\?\\/i, '')
    .toLowerCase();
};

export const registerWorkspace = async (
  store: WorkspaceStore,
  rootPath: string,
): Promise<WorkspaceSummary> => {
  const root = await fs.realpath(rootPath);
  const workspaceId = randomUUID();
  store.set(workspaceId, root);
  return { workspaceId, displayName: path.basename(root) || root };
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

export const resolveWorkspacePath = async (
  store: WorkspaceStore,
  workspaceId: string,
  relativePath: string,
  mustExist: boolean,
): Promise<{ root: string; absolutePath: string } | undefined> => {
  const root = store.get(workspaceId);
  if (!root) return undefined;
  const absolutePath = path.resolve(root, relativePath);
  if (!isInside(root, absolutePath)) return undefined;
  if (mustExist) {
    const real = await fs.realpath(absolutePath);
    if (!isInside(root, real)) return undefined;
  } else {
    const parent = await fs.realpath(path.dirname(absolutePath));
    if (!isInside(root, parent)) return undefined;
  }
  return { root, absolutePath };
};

const collectMarkdownFiles = async (
  root: string,
  current: string,
): Promise<WorkspaceFile[]> => {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: WorkspaceFile[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(root, absolute)));
    } else if (entry.isFile() && /\.(md|markdown)$/i.test(entry.name)) {
      const relativePath = path
        .relative(root, absolute)
        .split(path.sep)
        .join('/');
      files.push({ relativePath, displayName: entry.name });
    }
  }
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
};

export const listMarkdownFiles = (root: string): Promise<WorkspaceFile[]> =>
  collectMarkdownFiles(root, root);

export const readDocument = async (
  absolutePath: string,
  relativePath: string,
): Promise<DocumentData> => ({
  relativePath,
  content: await fs.readFile(absolutePath, 'utf8'),
  encoding: 'utf-8',
});

const writeAtomically = async (
  absolutePath: string,
  content: string,
  flag: 'wx' | 'w',
): Promise<number> => {
  const temporaryPath = `${absolutePath}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporaryPath, 'w');
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    if (flag === 'wx') {
      await fs.link(temporaryPath, absolutePath);
      await fs.unlink(temporaryPath);
    } else {
      await fs.rename(temporaryPath, absolutePath);
    }
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
  return Buffer.byteLength(content, 'utf8');
};

export const createDocument = (
  absolutePath: string,
  relativePath: string,
): Promise<WriteResult> =>
  writeAtomically(absolutePath, '', 'wx').then((bytesWritten) => ({
    relativePath,
    bytesWritten,
    savedAt: new Date().toISOString(),
  }));

export const writeDocument = (
  absolutePath: string,
  relativePath: string,
  content: string,
): Promise<WriteResult> =>
  writeAtomically(absolutePath, content, 'w').then((bytesWritten) => ({
    relativePath,
    bytesWritten,
    savedAt: new Date().toISOString(),
  }));
