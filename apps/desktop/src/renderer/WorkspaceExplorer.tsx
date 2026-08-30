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
  onRename: (relativePath: string, newName: string) => Promise<boolean>;
  onDelete: (relativePath: string) => Promise<void>;
}

const isMarkdown = (entry: WorkspaceEntry): boolean =>
  entry.kind === 'file' && /\.(md|markdown)$/i.test(entry.displayName);

const parentPathOf = (relativePath: string): string => {
  const index = relativePath.lastIndexOf('/');
  return index === -1 ? '' : relativePath.slice(0, index);
};

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={`workspace-tree__chevron${
      expanded ? ' workspace-tree__chevron--expanded' : ''
    }`}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="m8 9 4 4 4-4" />
  </svg>
);

const FolderIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className="workspace-tree__entry-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d={expanded ? 'M3.5 7.5h6l1.8 2H20.5v9h-17z' : 'M3.5 7.5h6l1.8 2H20.5'}
    />
    <path d={expanded ? 'M3.5 7.5v-1h6l1.8 2' : 'M3.5 7.5v11h17v-9'} />
  </svg>
);

const FileIcon = () => (
  <svg
    className="workspace-tree__entry-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="M6.5 3.5h7l4 4v13h-11z" />
    <path d="M13.5 3.5v4h4" />
  </svg>
);

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
  const [editingPath, setEditingPath] = useState<string>();
  const [editingName, setEditingName] = useState('');
  const [renamePending, setRenamePending] = useState(false);
  const [contextMenuPath, setContextMenuPath] = useState<string>();
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

  const beginRename = (entry: WorkspaceEntry) => {
    setContextMenuPath(undefined);
    setEditingPath(entry.relativePath);
    setEditingName(entry.displayName);
  };

  const cancelRename = () => {
    if (renamePending) return;
    setEditingPath(undefined);
    setEditingName('');
  };

  const commitRename = async () => {
    if (!editingPath || renamePending) return;
    const name = editingName.trim();
    const entry = entries.find((item) => item.relativePath === editingPath);
    if (!entry || !name || name === entry.displayName) {
      cancelRename();
      return;
    }
    setRenamePending(true);
    try {
      const renamed = await onRename(editingPath, name);
      if (renamed) {
        setEditingPath(undefined);
        setEditingName('');
      }
    } catch {
      // The parent displays the operation error; keep the input available for retry.
    } finally {
      setRenamePending(false);
    }
  };

  const askDelete = (entry: WorkspaceEntry) => {
    const message =
      entry.kind === 'directory'
        ? `'${entry.displayName}' 폴더와 내부 항목을 삭제할까요?`
        : `'${entry.displayName}' 파일을 삭제할까요?`;
    if (window.confirm(message)) void onDelete(entry.relativePath);
  };

  useEffect(() => {
    if (
      contextMenuPath &&
      !entries.some((entry) => entry.relativePath === contextMenuPath)
    ) {
      setContextMenuPath(undefined);
    }
  }, [contextMenuPath, entries]);

  const renderEntries = (parentPath: string, depth: number): ReactNode => {
    const children = childrenByParent.get(parentPath) ?? [];
    return children.map((entry) => {
      const expanded = expandedPaths.has(entry.relativePath);
      const markdown = isMarkdown(entry);
      const editing = editingPath === entry.relativePath;
      return (
        <li className="workspace-tree__item" key={entry.relativePath}>
          <div
            className={`workspace-tree__row${
              selectedPath === entry.relativePath
                ? ' workspace-tree__row--selected'
                : ''
            }`}
            style={{ '--tree-depth': depth } as CSSProperties}
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenuPath(entry.relativePath);
            }}
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
                <ChevronIcon expanded={expanded} />
              </button>
            ) : (
              <span
                className="workspace-tree__twisty workspace-tree__twisty--file"
                aria-hidden="true"
              />
            )}
            {editing ? (
              <div className="workspace-tree__rename">
                <input
                  className="workspace-tree__rename-input"
                  value={editingName}
                  aria-label={`${entry.displayName} 이름 변경 입력`}
                  autoFocus
                  disabled={renamePending}
                  onChange={(event) => setEditingName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void commitRename();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      cancelRename();
                    }
                  }}
                />
                <button
                  className="workspace-tree__rename-confirm"
                  type="button"
                  disabled={renamePending}
                  aria-label={`${entry.displayName} 이름 변경 저장`}
                  onClick={() => void commitRename()}
                >
                  저장
                </button>
                <button
                  className="workspace-tree__rename-cancel"
                  type="button"
                  disabled={renamePending}
                  aria-label="이름 변경 취소"
                  onClick={cancelRename}
                >
                  취소
                </button>
              </div>
            ) : (
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
                onDoubleClick={(event) => {
                  event.preventDefault();
                  beginRename(entry);
                }}
                onClick={() => {
                  setContextMenuPath(undefined);
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
                  {entry.kind === 'directory' ? (
                    <FolderIcon expanded={expanded} />
                  ) : (
                    <FileIcon />
                  )}
                </span>
                <span className="workspace-tree__label">
                  {entry.displayName}
                </span>
              </button>
            )}
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
                onClick={() => beginRename(entry)}
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
          {contextMenuPath === entry.relativePath && !editing && (
            <div
              className="workspace-tree__context-menu"
              role="menu"
              aria-label={`${entry.displayName} 메뉴`}
            >
              {entry.kind === 'directory' && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setContextMenuPath(undefined);
                      askCreate(entry.relativePath, 'file');
                    }}
                  >
                    새 파일
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setContextMenuPath(undefined);
                      askCreate(entry.relativePath, 'directory');
                    }}
                  >
                    새 폴더
                  </button>
                </>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => beginRename(entry)}
              >
                이름 변경
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setContextMenuPath(undefined);
                  askDelete(entry);
                }}
              >
                삭제
              </button>
            </div>
          )}
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
