import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { WorkspaceEntry } from '../shared/ipc';

type EntryKind = 'file' | 'directory';

interface WorkspaceExplorerProps {
  entries: WorkspaceEntry[];
  selectedPath?: string;
  onOpen: (relativePath: string) => void;
  onCreate: (
    parentPath: string,
    kind: EntryKind,
    name: string,
  ) => Promise<void>;
  onRename: (relativePath: string, newName: string) => Promise<void>;
  onDelete: (relativePath: string) => Promise<void>;
}

const isMarkdown = (entry: WorkspaceEntry): boolean =>
  entry.kind === 'file' && /\.(md|markdown)$/i.test(entry.displayName);

const parentPathOf = (relativePath: string): string => {
  const index = relativePath.lastIndexOf('/');
  return index === -1 ? '' : relativePath.slice(0, index);
};

export const WorkspaceExplorer = ({
  entries,
  selectedPath,
  onOpen,
  onCreate,
  onRename,
  onDelete,
}: WorkspaceExplorerProps) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(['']),
  );
  useEffect(() => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      for (const entry of entries) {
        if (entry.kind === 'directory') next.add(entry.relativePath);
      }
      return next;
    });
  }, [entries]);
  const childrenByParent = useMemo(() => {
    const groups = new Map<string, WorkspaceEntry[]>();
    for (const entry of entries) {
      const parent = parentPathOf(entry.relativePath);
      const children = groups.get(parent) ?? [];
      children.push(entry);
      groups.set(parent, children);
    }
    return groups;
  }, [entries]);

  const askCreate = (parentPath: string, kind: EntryKind) => {
    const defaultName = kind === 'directory' ? '새 폴더' : '새 문서.md';
    const name = window.prompt(
      kind === 'directory' ? '새 폴더 이름' : '새 Markdown 파일 이름',
      defaultName,
    );
    if (!name?.trim()) return;
    void onCreate(parentPath, kind, name.trim());
  };

  const askRename = (entry: WorkspaceEntry) => {
    const name = window.prompt('새 이름', entry.displayName);
    if (!name?.trim() || name.trim() === entry.displayName) return;
    void onRename(entry.relativePath, name.trim());
  };

  const askDelete = (entry: WorkspaceEntry) => {
    const message =
      entry.kind === 'directory'
        ? `'${entry.displayName}' 폴더와 내부 항목을 삭제할까요?`
        : `'${entry.displayName}' 파일을 삭제할까요?`;
    if (window.confirm(message)) void onDelete(entry.relativePath);
  };

  const renderEntries = (parentPath: string, depth: number): ReactNode => {
    const children = childrenByParent.get(parentPath) ?? [];
    return children.map((entry) => {
      const expanded = expandedPaths.has(entry.relativePath);
      const markdown = isMarkdown(entry);
      return (
        <li className="workspace-tree__item" key={entry.relativePath}>
          <div
            className={`workspace-tree__row${
              selectedPath === entry.relativePath
                ? ' workspace-tree__row--selected'
                : ''
            }`}
            style={{ '--tree-depth': depth } as CSSProperties}
          >
            {entry.kind === 'directory' ? (
              <button
                className="workspace-tree__twisty"
                type="button"
                aria-label={`${entry.displayName} 폴더 ${expanded ? '접기' : '펼치기'}`}
                aria-expanded={expanded}
                onClick={() =>
                  setExpandedPaths((current) => {
                    const next = new Set(current);
                    if (next.has(entry.relativePath))
                      next.delete(entry.relativePath);
                    else next.add(entry.relativePath);
                    return next;
                  })
                }
              >
                {expanded ? '⌄' : '›'}
              </button>
            ) : (
              <span
                className="workspace-tree__twisty workspace-tree__twisty--file"
                aria-hidden="true"
              >
                ·
              </span>
            )}
            <button
              className="workspace-tree__name"
              type="button"
              disabled={entry.kind === 'file' && !markdown}
              aria-label={
                entry.kind === 'file' ? entry.relativePath : undefined
              }
              title={
                entry.kind === 'file' && !markdown
                  ? 'Markdown 파일만 열 수 있습니다.'
                  : entry.relativePath
              }
              onClick={() => {
                if (entry.kind === 'directory') {
                  setExpandedPaths((current) => {
                    const next = new Set(current);
                    if (next.has(entry.relativePath))
                      next.delete(entry.relativePath);
                    else next.add(entry.relativePath);
                    return next;
                  });
                } else if (markdown) onOpen(entry.relativePath);
              }}
            >
              <span aria-hidden="true" className="workspace-tree__icon">
                {entry.kind === 'directory' ? (expanded ? '▾' : '▸') : '◇'}
              </span>
              <span className="workspace-tree__label">{entry.displayName}</span>
            </button>
            <div className="workspace-tree__actions">
              {entry.kind === 'directory' && (
                <>
                  <button
                    type="button"
                    onClick={() => askCreate(entry.relativePath, 'file')}
                    aria-label={`${entry.displayName}에 파일 추가`}
                  >
                    + 파일
                  </button>
                  <button
                    type="button"
                    onClick={() => askCreate(entry.relativePath, 'directory')}
                    aria-label={`${entry.displayName}에 폴더 추가`}
                  >
                    + 폴더
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => askRename(entry)}
                aria-label={`${entry.displayName} 이름 변경`}
              >
                이름 변경
              </button>
              <button
                type="button"
                onClick={() => askDelete(entry)}
                aria-label={`${entry.displayName} 삭제`}
              >
                삭제
              </button>
            </div>
          </div>
          {entry.kind === 'directory' && expanded && (
            <ul
              className="workspace-tree"
              aria-label={`${entry.displayName} 폴더 내용`}
            >
              {renderEntries(entry.relativePath, depth + 1)}
            </ul>
          )}
        </li>
      );
    });
  };

  return (
    <section className="workspace-explorer" aria-label="파일 탐색기">
      <div className="workspace-explorer__toolbar">
        <span>탐색기</span>
        <div>
          <button type="button" onClick={() => askCreate('', 'file')}>
            + 파일
          </button>
          <button type="button" onClick={() => askCreate('', 'directory')}>
            + 폴더
          </button>
        </div>
      </div>
      {entries.length > 0 ? (
        <ul
          className="workspace-tree workspace-tree--root"
          aria-label="워크스페이스 파일 목록"
        >
          {renderEntries('', 0)}
        </ul>
      ) : (
        <p className="workspace-tree__empty">
          표시할 파일이나 폴더가 없습니다.
        </p>
      )}
    </section>
  );
};
