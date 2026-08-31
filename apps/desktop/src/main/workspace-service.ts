import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type {
  WorkspaceFile,
  WorkspaceSummary,
  WriteResult,
  DocumentData,
  WorkspaceEntry,
} from '../shared/ipc';

// Generated and dependency-owned trees do not contain document workspace
// entries. Excluding them keeps repository-sized folders from expanding the
// initial recursive scan with irrelevant files.
export const DEFAULT_IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  'coverage',
  '.cache',
  '.vite',
  '.next',
  '.nuxt',
  '.parcel-cache',
  '.serverless',
  '.webpack',
  'test-results',
  'playwright-report',
  'lib-cov',
  '.nyc_output',
  'jspm_packages',
]);

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

export const isInside = (root: string, candidate: string): boolean => {
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
  const storedRoot = store.get(workspaceId);
  if (!storedRoot) return undefined;
  const root = await fs.realpath(storedRoot);
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
      if (DEFAULT_IGNORED_DIRECTORIES.has(entry.name)) continue;
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

const collectWorkspaceEntries = async (
  root: string,
  current: string,
): Promise<WorkspaceEntry[]> => {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const result: WorkspaceEntry[] = [];
  for (const entry of entries) {
    if (
      entry.name.startsWith('.') ||
      (entry.isDirectory() && DEFAULT_IGNORED_DIRECTORIES.has(entry.name)) ||
      (!entry.isDirectory() && !entry.isFile())
    )
      continue;
    const absolutePath = path.join(current, entry.name);
    const relativePath = path
      .relative(root, absolutePath)
      .split(path.sep)
      .join('/');
    const kind = entry.isDirectory() ? 'directory' : 'file';
    result.push({ relativePath, displayName: entry.name, kind });
    if (entry.isDirectory()) {
      result.push(...(await collectWorkspaceEntries(root, absolutePath)));
    }
  }
  return result.sort((a, b) => {
    const kindOrder = a.kind === b.kind ? 0 : a.kind === 'directory' ? -1 : 1;
    return kindOrder || a.relativePath.localeCompare(b.relativePath);
  });
};

export const listWorkspaceEntries = (root: string): Promise<WorkspaceEntry[]> =>
  collectWorkspaceEntries(root, root);

export const getDocumentRevision = (content: string): string =>
  createHash('sha256').update(content, 'utf8').digest('hex');

export const readDocument = async (
  absolutePath: string,
  relativePath: string,
): Promise<DocumentData> => {
  const content = await fs.readFile(absolutePath, 'utf8');
  return {
    relativePath,
    content,
    encoding: 'utf-8',
    revision: getDocumentRevision(content),
  };
};

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
    revision: getDocumentRevision(''),
  }));

export const createWorkspaceDirectory = async (
  absolutePath: string,
): Promise<void> => {
  await fs.mkdir(absolutePath);
};

export const renameWorkspaceEntry = (
  absolutePath: string,
  destinationPath: string,
): Promise<void> => fs.rename(absolutePath, destinationPath);

export const moveWorkspaceEntry = (
  absolutePath: string,
  destinationPath: string,
): Promise<void> => fs.rename(absolutePath, destinationPath);

export const deleteWorkspaceEntry = (absolutePath: string): Promise<void> =>
  fs.rm(absolutePath, { recursive: true, force: false });

export const createDocumentWithContent = (
  absolutePath: string,
  relativePath: string,
  content: string,
): Promise<WriteResult> =>
  writeAtomically(absolutePath, content, 'wx').then((bytesWritten) => ({
    relativePath,
    bytesWritten,
    savedAt: new Date().toISOString(),
    revision: getDocumentRevision(content),
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
    revision: getDocumentRevision(content),
  }));
