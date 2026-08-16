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

const App = ({ state = 'empty' }: AppProps) => (
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
          <button className="button button--primary" type="button">
            폴더 선택
          </button>
        </div>
        <WorkspaceState state={state} />
      </aside>

      <section className="editor-panel" aria-labelledby="editor-title">
        <div className="panel-heading">
          <div>
            <p className="panel-heading__eyebrow">EDITOR</p>
            <h2 id="editor-title">새 문서</h2>
          </div>
          <span className="panel-heading__meta">저장되지 않음</span>
        </div>
        <textarea
          aria-label="Markdown 편집기"
          className="markdown-editor"
          placeholder="문서를 선택하거나 새 Markdown을 작성하세요."
        />
      </section>

      <section className="preview-panel" aria-labelledby="preview-title">
        <div className="panel-heading">
          <div>
            <p className="panel-heading__eyebrow">PREVIEW</p>
            <h2 id="preview-title">미리보기</h2>
          </div>
        </div>
        <div className="preview-empty">
          <p className="preview-empty__title">미리볼 문서가 없습니다.</p>
          <p>문서를 열면 안전한 Markdown 미리보기가 이 영역에 표시됩니다.</p>
        </div>
      </section>
    </div>

    <footer className="app-status" aria-label="문서 상태">
      <span>준비됨</span>
      <span>로컬 파일 기능은 다음 단계에서 연결됩니다.</span>
    </footer>
  </main>
);

export default App;
