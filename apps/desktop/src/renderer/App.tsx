import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import type { WorkspaceFile } from '../shared/ipc';
import { renderMarkdownPreview } from './markdown-preview';

export type ShellState = 'empty' | 'error' | 'loading';

interface AppProps {
  state?: ShellState;
}

const WorkspaceState = ({ state }: Required<AppProps>) => {
  if (state === 'loading') {
    return (
      <p className="workspace-state" role="status">
        문서 목록을 준비하고 있습니다.
      </p>
    );
  }

  if (state === 'error') {
    return (
      <p className="workspace-state workspace-state--error" role="alert">
        문서 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  return (
    <div className="workspace-state">
      <p className="workspace-state__title">열어 둔 문서가 없습니다.</p>
      <p className="workspace-state__description">
        로컬 문서 폴더를 선택하면 Markdown 파일이 여기에 표시됩니다.
      </p>
    </div>
  );
};

const App = ({ state: initialState = 'empty' }: AppProps) => {
  const [state, setState] = useState<ShellState>(initialState);
  const [workspaceId, setWorkspaceId] = useState<string>();
  const [workspaceName, setWorkspaceName] = useState<string>();
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>();
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const chooseWorkspace = async () => {
    setState('loading');
    const chosen = await window.dock.workspace.choose();
    if (chosen.ok === false) {
      setState(chosen.error.code === 'CANCELLED' ? 'empty' : 'error');
      return;
    }
    setWorkspaceId(chosen.value.workspaceId);
    setWorkspaceName(chosen.value.displayName);
    const listed = await window.dock.workspace.listMarkdownFiles({
      workspaceId: chosen.value.workspaceId,
    });
    if (!listed.ok) {
      setState('error');
      return;
    }
    setFiles(listed.value.files);
    setState('empty');
  };

  const openDocument = async (relativePath: string) => {
    if (!workspaceId) return;
    const result = await window.dock.document.read({
      workspaceId,
      relativePath,
    });
    if (!result.ok) {
      setState('error');
      return;
    }
    setSelectedPath(relativePath);
    setContent(result.value.content);
    setSavedContent(result.value.content);
  };

  const saveDocument = async () => {
    if (!workspaceId || !selectedPath) return;
    const result = await window.dock.document.write({
      workspaceId,
      relativePath: selectedPath,
      content,
    });
    if (result.ok) setSavedContent(content);
    else setState('error');
  };

  const dirty = content !== savedContent;
  const previewHtml = selectedPath ? renderMarkdownPreview(content) : '';

  const handlePreviewClick = (event: MouseEvent<HTMLElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-dock-document]',
    );
    if (!target || !selectedPath) return;
    event.preventDefault();
    const link = target.dataset.dockDocument;
    if (!link) return;
    const base = selectedPath.includes('/')
      ? selectedPath.slice(0, selectedPath.lastIndexOf('/') + 1)
      : '';
    const nextPath = link.startsWith('./') ? `${base}${link.slice(2)}` : link;
    if (!nextPath.split('/').includes('..')) void openDocument(nextPath);
  };

  return (
    <main className="app-shell" aria-label="Dock 작업 공간">
      <header className="app-header">
        <div>
          <p className="app-header__eyebrow">JARVIS</p>
          <h1 className="app-header__title">Dock</h1>
        </div>
        <button className="button button--quiet" type="button">
          명령 팔레트 열기
        </button>
      </header>

      <div className="workspace-layout">
        <aside className="workspace-sidebar" aria-labelledby="workspace-title">
          <div className="panel-heading">
            <div>
              <p className="panel-heading__eyebrow">DOCUMENT WORKSPACE</p>
              <h2 id="workspace-title">문서</h2>
            </div>
            <button
              className="button button--primary"
              type="button"
              onClick={chooseWorkspace}
            >
              폴더 선택
            </button>
          </div>
          {workspaceName && (
            <p className="workspace-name">현재 폴더: {workspaceName}</p>
          )}
          {files.length > 0 ? (
            <ul className="file-list" aria-label="Markdown 파일 목록">
              {files.map((file) => (
                <li key={file.relativePath}>
                  <button
                    className="file-list__item"
                    type="button"
                    onClick={() => openDocument(file.relativePath)}
                  >
                    {file.relativePath}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <WorkspaceState state={state} />
          )}
        </aside>

        <section className="editor-panel" aria-labelledby="editor-title">
          <div className="panel-heading">
            <div>
              <p className="panel-heading__eyebrow">EDITOR</p>
              <h2 id="editor-title">{selectedPath ?? '새 문서'}</h2>
            </div>
            <button
              className="button button--quiet"
              type="button"
              onClick={saveDocument}
              disabled={!selectedPath || !dirty}
            >
              {dirty ? '저장' : '저장됨'}
            </button>
          </div>
          <textarea
            aria-label="Markdown 편집기"
            className="markdown-editor"
            placeholder="문서를 선택하거나 새 Markdown을 작성하세요."
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </section>

        <section className="preview-panel" aria-labelledby="preview-title">
          <div className="panel-heading">
            <div>
              <p className="panel-heading__eyebrow">PREVIEW</p>
              <h2 id="preview-title">미리보기</h2>
            </div>
          </div>
          {selectedPath ? (
            <div
              className="preview-content"
              onClick={handlePreviewClick}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <div className="preview-empty">
              <p className="preview-empty__title">미리볼 문서가 없습니다.</p>
              <p>
                문서를 열면 안전한 Markdown 미리보기가 이 영역에 표시됩니다.
              </p>
            </div>
          )}
        </section>
      </div>

      <footer className="app-status" aria-label="문서 상태">
        <span>{dirty ? '변경사항 있음' : '준비됨'}</span>
        <span>{workspaceName ?? '폴더를 선택해 문서를 시작하세요.'}</span>
      </footer>
    </main>
  );
};

export default App;
