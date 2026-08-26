import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent, MouseEvent } from 'react';
import type {
  ResearchSearchResult,
  ResearchTabInfo,
  WorkspaceFile,
} from '../shared/ipc';
import {
  extractWorkspaceImageAssets,
  findRemovedWorkspaceImageAssets,
} from '../shared/image-assets';
import {
  formatMarkdownLink,
  insertMarkdownLink,
  type LinkInsertTarget,
} from './link-search';
import {
  formatMarkdownImage,
  insertMarkdownImage,
  mockImageProvider,
  type ImageSearchResult,
} from './image-search';
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

const trapDialogFocus = (event: KeyboardEvent<HTMLElement>): void => {
  if (event.key !== 'Tab') return;
  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const activeElement = document.activeElement;

  if (event.shiftKey && activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

const App = ({ state: initialState = 'empty' }: AppProps) => {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const commandTriggerRef = useRef<HTMLButtonElement>(null);
  const editorSelectionRef = useRef({ start: 0, end: 0 });
  const [state, setState] = useState<ShellState>(initialState);
  const [workspaceId, setWorkspaceId] = useState<string>();
  const [workspaceName, setWorkspaceName] = useState<string>();
  const [workspaceFolderError, setWorkspaceFolderError] = useState('');
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>();
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [saveError, setSaveError] = useState('');
  const [newDocumentPath, setNewDocumentPath] = useState('untitled.md');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [activeCommand, setActiveCommand] = useState<'link' | 'image'>();
  const [linkQuery, setLinkQuery] = useState('');
  const [linkStatus, setLinkStatus] = useState<
    'idle' | 'search' | 'opening' | 'error'
  >('idle');
  const [linkError, setLinkError] = useState('');
  const [researchOpen, setResearchOpen] = useState(false);
  const [researchError, setResearchError] = useState('');
  const [researchResults, setResearchResults] = useState<
    ResearchSearchResult[]
  >([]);
  const [researchResultsByTab, setResearchResultsByTab] = useState<
    Record<string, ResearchSearchResult[]>
  >({});
  const [researchTabs, setResearchTabs] = useState<ResearchTabInfo[]>([]);
  const [activeResearchTabId, setActiveResearchTabId] = useState<string>();
  const [researchUrl, setResearchUrl] = useState('');
  const [researchLoading, setResearchLoading] = useState(false);
  const [imageQuery, setImageQuery] = useState('');
  const [imageStatus, setImageStatus] = useState<
    'idle' | 'search' | 'loading' | 'results' | 'empty' | 'error' | 'selected'
  >('idle');
  const [imageResults, setImageResults] = useState<ImageSearchResult[]>([]);
  const [imageError, setImageError] = useState('');
  const [imageErrorCode, setImageErrorCode] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImageSearchResult>();
  const [imageAltText, setImageAltText] = useState('');
  const [imageThumbnailErrors, setImageThumbnailErrors] = useState<
    Record<string, boolean>
  >({});
  const [previewImageSources, setPreviewImageSources] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    setState(initialState);
    const e2eMode = new URLSearchParams(window.location.search).get('e2e');
    if (
      e2eMode !== 'link' &&
      e2eMode !== 'image' &&
      e2eMode !== 'research-security'
    ) {
      return;
    }
    setWorkspaceId('11111111-1111-4111-8111-111111111111');
    setWorkspaceName('fixture');
    setFiles([{ relativePath: 'guide.md', displayName: 'guide.md' }]);
    setSelectedPath('guide.md');
    setContent('# Start');
    setSavedContent('# Start');
  }, [initialState]);

  const refreshResearchInfo = useCallback(async () => {
    const response = await window.dock.research.info();
    if (response.ok === false) {
      if (response.error.code === 'RESEARCH_NOT_OPEN') setResearchOpen(false);
      return;
    }
    setResearchTabs(response.value.tabs);
    setActiveResearchTabId(response.value.activeTabId ?? undefined);
    const activeTab = response.value.tabs.find(
      (tab) => tab.id === response.value.activeTabId,
    );
    setResearchUrl(activeTab?.url ?? '');
    setResearchLoading(activeTab?.loading ?? false);
    if (Array.isArray(response.value.results)) {
      setResearchResults(response.value.results);
      if (response.value.activeTabId) {
        setResearchResultsByTab((current) => ({
          ...current,
          [response.value.activeTabId as string]: response.value.results,
        }));
      }
    }
  }, []);

  useEffect(() => {
    if (!researchOpen) return;
    void refreshResearchInfo();
    const interval = window.setInterval(() => {
      void refreshResearchInfo();
    }, 500);
    return () => window.clearInterval(interval);
  }, [researchOpen, refreshResearchInfo]);

  useEffect(() => {
    let cancelled = false;
    if (!workspaceId || !selectedPath) {
      setPreviewImageSources({});
      return () => {
        cancelled = true;
      };
    }

    const assetPaths = extractWorkspaceImageAssets(content, selectedPath);
    setPreviewImageSources((current) =>
      Object.fromEntries(
        assetPaths
          .filter((assetPath) => current[assetPath])
          .map((assetPath) => [assetPath, current[assetPath]]),
      ),
    );
    void Promise.all(
      assetPaths.map(async (assetPath) => {
        try {
          const response = await window.dock.image.read({
            workspaceId,
            assetPath,
          });
          return response.ok
            ? ([assetPath, response.value.dataUrl] as const)
            : null;
        } catch {
          return null;
        }
      }),
    ).then((sources) => {
      if (cancelled) return;
      setPreviewImageSources(Object.fromEntries(sources.filter(Boolean)));
    });

    return () => {
      cancelled = true;
    };
  }, [content, selectedPath, workspaceId]);

  const refreshFiles = async (nextWorkspaceId: string) => {
    const listed = await window.dock.workspace.listMarkdownFiles({
      workspaceId: nextWorkspaceId,
    });
    if (!listed.ok) {
      setState('error');
      return false;
    }
    setFiles(listed.value.files);
    return true;
  };

  const chooseWorkspace = async () => {
    setState('loading');
    const chosen = await window.dock.workspace.choose();
    if (chosen.ok === false) {
      setState(chosen.error.code === 'CANCELLED' ? 'empty' : 'error');
      return;
    }
    setWorkspaceId(chosen.value.workspaceId);
    setWorkspaceName(chosen.value.displayName);
    setSelectedPath(undefined);
    setContent('');
    setSavedContent('');
    setSaveError('');
    setWorkspaceFolderError('');
    if (!(await refreshFiles(chosen.value.workspaceId))) return;
    setState('empty');
  };

  const openWorkspaceFolder = async (folder: 'document' | 'assets') => {
    if (!workspaceId) {
      setWorkspaceFolderError('먼저 문서 폴더를 선택해 주세요.');
      return;
    }
    try {
      const response = await window.dock.workspace.openFolder({
        workspaceId,
        folder,
      });
      setWorkspaceFolderError(
        response.ok ? '' : '폴더를 파일 탐색기로 열지 못했습니다.',
      );
    } catch {
      setWorkspaceFolderError('폴더를 파일 탐색기로 열지 못했습니다.');
    }
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
    editorSelectionRef.current = {
      start: result.value.content.length,
      end: result.value.content.length,
    };
    setSaveError('');
  };

  const saveDocument = async () => {
    if (!workspaceId || !selectedPath) return;
    const removedAssets = findRemovedWorkspaceImageAssets(
      savedContent,
      content,
      selectedPath,
    );
    const shouldDeleteAssets =
      removedAssets.length > 0 &&
      window.confirm(
        `본문에서 ${removedAssets.length}개의 이미지 참조가 제거되었습니다.\n저장된 원본 파일도 삭제하시겠습니까?`,
      );
    const result = await window.dock.document.write({
      workspaceId,
      relativePath: selectedPath,
      content,
    });
    if (result.ok) {
      setSavedContent(content);
      setSaveError('');
      if (shouldDeleteAssets) {
        const cleanupResults = await Promise.all(
          removedAssets.map((assetPath) =>
            window.dock.image.delete({
              workspaceId,
              assetPath,
            }),
          ),
        );
        if (
          cleanupResults.some(
            (cleanup) => !cleanup.ok || !cleanup.value.deleted,
          )
        ) {
          setSaveError(
            '문서는 저장했지만 일부 이미지 원본을 삭제하지 못했습니다.',
          );
        }
      }
    } else {
      setSaveError('문서를 저장하지 못했습니다. 편집 내용은 유지됩니다.');
    }
  };

  const createDocument = async () => {
    if (!workspaceId) return;
    const relativePath = newDocumentPath.trim();
    if (!relativePath) {
      setState('error');
      return;
    }
    setState('loading');
    const result = await window.dock.document.create({
      workspaceId,
      relativePath,
    });
    if (!result.ok) {
      setState('error');
      return;
    }
    if (!(await refreshFiles(workspaceId))) return;
    setSelectedPath(relativePath);
    setContent('');
    setSavedContent('');
    editorSelectionRef.current = { start: 0, end: 0 };
    setSaveError('');
    setNewDocumentPath('');
    setState('empty');
  };

  const dirty = content !== savedContent;
  const previewHtml = selectedPath
    ? renderMarkdownPreview(content, {
        documentPath: selectedPath,
        imageSources: previewImageSources,
      })
    : '';

  const rememberEditorSelection = () => {
    const editor = editorRef.current;
    if (!editor) return editorSelectionRef.current;
    editorSelectionRef.current = {
      start: editor.selectionStart,
      end: editor.selectionEnd,
    };
    return editorSelectionRef.current;
  };

  const openCommandPalette = () => {
    rememberEditorSelection();
    setLinkQuery('');
    setImageQuery('');
    setActiveCommand(undefined);
    setLinkError('');
    setLinkStatus('idle');
    setImageResults([]);
    setImageError('');
    setImageErrorCode('');
    setImageStatus('idle');
    setSelectedImage(undefined);
    setImageAltText('');
    setImageThumbnailErrors({});
    setCommandPaletteOpen(true);
  };

  const closeCommandPalette = () => {
    setCommandPaletteOpen(false);
    setActiveCommand(undefined);
    setLinkQuery('');
    setLinkError('');
    setLinkStatus('idle');
    setImageQuery('');
    setImageResults([]);
    setImageError('');
    setImageErrorCode('');
    setImageStatus('idle');
    setSelectedImage(undefined);
    setImageAltText('');
    setImageThumbnailErrors({});
    commandTriggerRef.current?.focus();
  };

  const openLinkSearch = async () => {
    const wasResearchOpen = researchOpen;
    setLinkStatus('opening');
    setLinkError('');
    setResearchOpen(true);
    try {
      const response = await window.dock.research.open({
        query: linkQuery,
      });
      if (response.ok === false) {
        if (!wasResearchOpen) setResearchOpen(false);
        setLinkError('Research View를 열지 못했습니다. 다시 시도해 주세요.');
        setLinkStatus('error');
        return;
      }
      setResearchError('');
      setResearchResults(response.value.results);
      const info = await window.dock.research.info();
      if (info.ok && info.value.activeTabId) {
        setResearchResultsByTab((current) => ({
          ...current,
          [info.value.activeTabId as string]: response.value.results,
        }));
      } else {
        setResearchResults(response.value.results);
      }
      closeCommandPalette();
    } catch {
      if (!wasResearchOpen) setResearchOpen(false);
      setLinkError('Research View를 열지 못했습니다. 다시 시도해 주세요.');
      setLinkStatus('error');
    }
  };

  const insertResearchLink = (result: LinkInsertTarget) => {
    try {
      const selection = editorSelectionRef.current;
      const nextContent = insertMarkdownLink(
        content,
        result,
        selection.start,
        selection.end,
      );
      setContent(nextContent);
      setResearchError('');
      const cursor = selection.start + formatMarkdownLink(result).length;
      editorSelectionRef.current = { start: cursor, end: cursor };
      requestAnimationFrame(() => {
        editorRef.current?.focus();
        editorRef.current?.setSelectionRange(cursor, cursor);
      });
    } catch {
      setResearchError('허용되지 않은 URL이라 링크를 삽입할 수 없습니다.');
    }
  };

  const insertCurrentResearchLink = async () => {
    const response = await window.dock.research.currentLink();
    if (response.ok === false) {
      setResearchError('현재 페이지 링크를 삽입할 수 없습니다.');
      return;
    }
    insertResearchLink(response.value);
  };

  const closeResearchView = async () => {
    const response = await window.dock.research.close();
    if (response.ok === false) {
      setResearchError('Research View를 닫지 못했습니다.');
      return;
    }
    setResearchOpen(false);
    setResearchError('');
    setResearchResults([]);
    setResearchResultsByTab({});
    setResearchTabs([]);
    setActiveResearchTabId(undefined);
    setResearchUrl('');
    setResearchLoading(false);
  };

  const selectResearchTab = async (tabId: string) => {
    const response = await window.dock.research.selectTab({ tabId });
    if (response.ok === false) {
      setResearchError('Research 탭을 선택하지 못했습니다.');
      return;
    }
    setResearchResults(researchResultsByTab[tabId] ?? []);
    await refreshResearchInfo();
  };

  const reloadResearchView = async () => {
    const response = await window.dock.research.reload();
    if (response.ok === false) {
      setResearchError('Research View를 새로고침하지 못했습니다.');
      return;
    }
    setResearchError('');
    await refreshResearchInfo();
  };

  const stopResearchView = async () => {
    const response = await window.dock.research.stop();
    if (response.ok === false) {
      setResearchError('Research View 탐색을 중지하지 못했습니다.');
      return;
    }
    await refreshResearchInfo();
  };

  const closeResearchTab = async (tabId: string) => {
    const response = await window.dock.research.closeTab({ tabId });
    if (response.ok === false) {
      setResearchError('Research 탭을 닫지 못했습니다.');
      return;
    }
    setResearchResultsByTab((current) => {
      const next = { ...current };
      delete next[tabId];
      return next;
    });
    await refreshResearchInfo();
    const info = await window.dock.research.info();
    if (info.ok && info.value.tabs.length === 0) {
      setResearchOpen(false);
      setResearchResults([]);
    }
  };

  const searchImages = async () => {
    setImageStatus('loading');
    setImageError('');
    setSelectedImage(undefined);
    setImageThumbnailErrors({});
    try {
      const e2eMode = new URLSearchParams(window.location.search).get('e2e');
      let results: ImageSearchResult[];
      if (e2eMode === 'image') {
        results = await mockImageProvider.search(imageQuery);
      } else {
        const response = await window.dock.image.search({
          query: imageQuery,
        });
        if (response.ok === false) {
          setImageResults([]);
          setImageError(
            response.error.code === 'IMAGE_SEARCH_UNAVAILABLE'
              ? '이미지 공급자에 연결할 수 없습니다.'
              : '이미지 검색에 실패했습니다. 다시 시도해 주세요.',
          );
          setImageStatus('error');
          return;
        }
        results = response.value.results;
      }
      setImageResults(results);
      setImageStatus(results.length > 0 ? 'results' : 'empty');
    } catch {
      setImageResults([]);
      setImageError('이미지 검색에 실패했습니다. 다시 시도해 주세요.');
      setImageStatus('error');
    }
  };

  const selectImageResult = (result: ImageSearchResult) => {
    setSelectedImage(result);
    setImageAltText(result.title);
    setImageStatus('selected');
  };

  const downloadImage = async () => {
    if (!workspaceId || !selectedPath || !selectedImage) {
      setImageError('먼저 Markdown 문서를 선택해 주세요.');
      setImageErrorCode('WORKSPACE_NOT_SELECTED');
      setImageStatus('error');
      return;
    }
    setImageStatus('loading');
    setImageError('');
    setImageErrorCode('');
    try {
      const response = await window.dock.image.download({
        workspaceId,
        relativePath: selectedPath,
        image: selectedImage,
      });
      if (response.ok === false) {
        setImageErrorCode(response.error.code);
        setImageError(
          response.error.code === 'IMAGE_TOO_LARGE'
            ? '이미지 파일이 너무 큽니다.'
            : response.error.code === 'IMAGE_UNSUPPORTED'
              ? '지원하지 않는 이미지 형식입니다.'
              : response.error.code === 'IMAGE_UNAVAILABLE'
                ? '이미지 공급자에 연결할 수 없습니다.'
                : '이미지를 다운로드하거나 저장하지 못했습니다.',
        );
        setImageStatus('error');
        return;
      }
      const altText = imageAltText.trim() || selectedImage.title;
      const markdown = formatMarkdownImage(
        altText,
        response.value.assetPath,
        selectedPath,
      );
      const selection = editorSelectionRef.current;
      const nextContent = insertMarkdownImage(
        content,
        altText,
        response.value.assetPath,
        selection.start,
        selection.end,
        selectedPath,
      );
      setContent(nextContent);
      closeCommandPalette();
      const cursor = selection.start + markdown.length;
      editorSelectionRef.current = { start: cursor, end: cursor };
      requestAnimationFrame(() => {
        editorRef.current?.focus();
        editorRef.current?.setSelectionRange(cursor, cursor);
      });
    } catch {
      setImageErrorCode('INTERNAL');
      setImageError('이미지를 다운로드하거나 저장하지 못했습니다.');
      setImageStatus('error');
    }
  };

  const insertClipboardImage = async (file: File) => {
    if (!workspaceId || !selectedPath) {
      setSaveError('이미지를 붙여넣으려면 먼저 Markdown 문서를 선택해 주세요.');
      return;
    }
    const supportedMimeTypes = [
      'image/png',
      'image/jpeg',
      'image/webp',
    ] as const;
    if (!(supportedMimeTypes as readonly string[]).includes(file.type)) {
      setSaveError('PNG, JPEG, WebP 이미지만 붙여넣을 수 있습니다.');
      return;
    }
    const mimeType = file.type as (typeof supportedMimeTypes)[number];
    try {
      const response = await window.dock.image.saveClipboard({
        workspaceId,
        relativePath: selectedPath,
        mimeType,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
      if (response.ok === false) {
        setSaveError('클립보드 이미지를 저장하지 못했습니다.');
        return;
      }
      const altText = '붙여넣은 이미지';
      const markdown = formatMarkdownImage(
        altText,
        response.value.assetPath,
        selectedPath,
      );
      const selection = editorSelectionRef.current;
      setContent(
        insertMarkdownImage(
          content,
          altText,
          response.value.assetPath,
          selection.start,
          selection.end,
          selectedPath,
        ),
      );
      setSaveError('');
      const cursor = selection.start + markdown.length;
      editorSelectionRef.current = { start: cursor, end: cursor };
      requestAnimationFrame(() => {
        editorRef.current?.focus();
        editorRef.current?.setSelectionRange(cursor, cursor);
      });
    } catch {
      setSaveError('클립보드 이미지를 저장하지 못했습니다.');
    }
  };

  const handleEditorPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find(
      (item) => item.kind === 'file' && item.type.startsWith('image/'),
    );
    if (!imageItem) return;
    event.preventDefault();
    const file = imageItem.getAsFile();
    if (file) void insertClipboardImage(file);
  };

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
        <div className="app-header__actions">
          {researchOpen && (
            <>
              <button
                className="button button--primary"
                type="button"
                onClick={() => void insertCurrentResearchLink()}
              >
                현재 페이지 링크 삽입
              </button>
              <button
                className="button button--quiet"
                type="button"
                onClick={() => void closeResearchView()}
              >
                Research View 닫기
              </button>
            </>
          )}
          <button
            ref={commandTriggerRef}
            aria-controls="command-dialog"
            aria-expanded={commandPaletteOpen}
            aria-haspopup="dialog"
            className="button button--quiet"
            type="button"
            onClick={openCommandPalette}
          >
            명령 팔레트 열기
          </button>
        </div>
      </header>

      {researchOpen && (
        <section className="research-workbench" aria-label="Research View">
          <div className="research-browser-column">
            <div className="research-browser-toolbar">
              <div
                className="research-tabs"
                role="tablist"
                aria-label="Research 탭"
              >
                {researchTabs.map((tab) => (
                  <div className="research-tab" key={tab.id}>
                    <button
                      className="research-tab__select"
                      type="button"
                      role="tab"
                      aria-selected={tab.id === activeResearchTabId}
                      onClick={() => void selectResearchTab(tab.id)}
                    >
                      {tab.title || '새 탭'}
                    </button>
                    <button
                      className="research-tab__close"
                      type="button"
                      aria-label={`${tab.title || '새 탭'} 닫기`}
                      onClick={() => void closeResearchTab(tab.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="research-browser-controls">
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => void reloadResearchView()}
                  aria-label="Research View 새로고침"
                >
                  ↻
                </button>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => void stopResearchView()}
                  disabled={!researchLoading}
                  aria-label="Research View 중지"
                >
                  ■
                </button>
                <input
                  className="research-browser-url"
                  aria-label="현재 URL"
                  value={researchUrl || '페이지 로딩 중'}
                  readOnly
                />
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => void closeResearchView()}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
          <section
            className="research-panel"
            aria-label="실험적 링크 검색 결과"
          >
            <div className="research-panel__heading">
              <div>
                <p className="panel-heading__eyebrow">LOCAL EXPERIMENT</p>
                <h2>검색 결과</h2>
              </div>
              <span>제목·HTTPS URL만 표시</span>
            </div>
            {researchResults.length > 0 ? (
              <ul className="research-results" aria-label="링크 검색 결과">
                {researchResults.map((result) => (
                  <li key={result.url}>
                    <button
                      className="research-result"
                      type="button"
                      onClick={() => insertResearchLink(result)}
                    >
                      <strong>{result.title}</strong>
                      <small>{result.url}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="research-panel__empty">
                카드 추출 결과가 없습니다. Research View에서 직접 탐색한 뒤 현재
                페이지 링크를 삽입할 수 있습니다.
              </p>
            )}
            {researchError && (
              <p
                className="research-status research-status--error"
                role="alert"
              >
                {researchError}
              </p>
            )}
          </section>
        </section>
      )}

      {commandPaletteOpen && (
        <div className="dialog-backdrop">
          <section
            id="command-dialog"
            className="command-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-dialog-title"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                closeCommandPalette();
              } else {
                trapDialogFocus(event);
              }
            }}
          >
            <div className="panel-heading">
              <div>
                <p className="panel-heading__eyebrow">COMMAND PALETTE</p>
                <h2 id="command-dialog-title">명령 팔레트</h2>
              </div>
              <button
                autoFocus
                className="button button--quiet"
                type="button"
                onClick={closeCommandPalette}
              >
                닫기
              </button>
            </div>

            {!activeCommand ? (
              <div className="command-list">
                <button
                  className="command-item"
                  type="button"
                  onClick={() => {
                    setActiveCommand('link');
                    setLinkStatus('search');
                    setLinkQuery('');
                    setLinkError('');
                  }}
                >
                  <strong>/link</strong>
                  <span>Research View 검색 및 현재 페이지 링크 삽입</span>
                </button>
                <button
                  className="command-item"
                  type="button"
                  onClick={() => {
                    setActiveCommand('image');
                    setImageStatus('search');
                    setImageQuery('');
                  }}
                >
                  <strong>/image</strong>
                  <span>이미지 검색 및 삽입</span>
                </button>
              </div>
            ) : activeCommand === 'link' ? (
              <div className="link-search-form">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void openLinkSearch();
                  }}
                >
                  <label htmlFor="link-search-query">링크 검색어</label>
                  <div className="link-search-form__row">
                    <input
                      id="link-search-query"
                      className="workspace-create__input"
                      value={linkQuery}
                      onChange={(event) => setLinkQuery(event.target.value)}
                      placeholder="예: electron security"
                      autoFocus
                    />
                    <button
                      className="button button--primary"
                      type="submit"
                      disabled={linkStatus === 'opening'}
                    >
                      Research View 열기
                    </button>
                  </div>
                </form>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={closeCommandPalette}
                >
                  취소
                </button>
              </div>
            ) : (
              <form
                className="link-search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void searchImages();
                }}
              >
                <label htmlFor="image-search-query">이미지 검색어</label>
                <div className="link-search-form__row">
                  <input
                    id="image-search-query"
                    className="workspace-create__input"
                    value={imageQuery}
                    onChange={(event) => setImageQuery(event.target.value)}
                    placeholder="예: electron"
                    autoFocus
                  />
                  <button
                    className="button button--primary"
                    type="submit"
                    disabled={imageStatus === 'loading'}
                  >
                    검색
                  </button>
                </div>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => void openWorkspaceFolder('assets')}
                  disabled={!workspaceId}
                >
                  이미지 폴더 열기
                </button>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={closeCommandPalette}
                >
                  취소
                </button>
              </form>
            )}

            {activeCommand === 'link' && linkStatus === 'opening' && (
              <p className="dialog-message" role="status">
                Research View에서 검색을 열고 있습니다.
              </p>
            )}
            {activeCommand === 'link' && linkStatus === 'error' && (
              <p className="dialog-message dialog-message--error" role="alert">
                {linkError}
              </p>
            )}
            {activeCommand === 'image' && imageStatus === 'loading' && (
              <p className="dialog-message" role="status">
                이미지를 검색하고 있습니다.
              </p>
            )}
            {activeCommand === 'image' && imageStatus === 'empty' && (
              <p className="dialog-message" role="status">
                이미지 검색 결과가 없습니다.
              </p>
            )}
            {activeCommand === 'image' && imageStatus === 'error' && (
              <p
                className="dialog-message dialog-message--error"
                role="alert"
                data-image-error-code={imageErrorCode || undefined}
              >
                {imageError}
              </p>
            )}
            {activeCommand === 'image' &&
              imageStatus === 'selected' &&
              selectedImage && (
                <div className="image-download-form">
                  <p className="dialog-message" role="status">
                    {selectedImage.title}을(를) 선택했습니다.
                  </p>
                  <label htmlFor="image-alt-text">대체 텍스트</label>
                  <input
                    id="image-alt-text"
                    className="workspace-create__input"
                    value={imageAltText}
                    onChange={(event) => setImageAltText(event.target.value)}
                  />
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={() => void downloadImage()}
                  >
                    다운로드 및 삽입
                  </button>
                </div>
              )}
            {activeCommand === 'image' && imageStatus === 'results' && (
              <ul className="image-results" aria-label="이미지 검색 결과">
                {imageResults.map((result) => (
                  <li key={result.id}>
                    <button
                      className="image-result"
                      type="button"
                      onClick={() => selectImageResult(result)}
                    >
                      {imageThumbnailErrors[result.id] ? (
                        <span
                          className="image-result__thumbnail image-result__thumbnail--empty"
                          aria-hidden="true"
                        >
                          미리보기 없음
                        </span>
                      ) : (
                        <img
                          className="image-result__thumbnail"
                          src={result.thumbnailUrl}
                          alt={`${result.title} 썸네일`}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setImageThumbnailErrors((current) => ({
                              ...current,
                              [result.id]: true,
                            }))
                          }
                        />
                      )}
                      <span className="image-result__details">
                        <strong>{result.title}</strong>
                        <span>{result.source}</span>
                        <small>{result.sourcePageUrl}</small>
                        <small>{result.license}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <div className="workspace-layout">
        <aside className="workspace-sidebar" aria-labelledby="workspace-title">
          <div className="panel-heading">
            <div>
              <p className="panel-heading__eyebrow">DOCUMENT WORKSPACE</p>
              <h2 id="workspace-title">문서</h2>
            </div>
            <div className="panel-heading__actions">
              <button
                className="button button--primary"
                type="button"
                onClick={chooseWorkspace}
              >
                폴더 선택
              </button>
              {workspaceName && (
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => void openWorkspaceFolder('document')}
                >
                  선택된 폴더 열기
                </button>
              )}
            </div>
          </div>
          {workspaceFolderError && (
            <p className="workspace-folder-error" role="alert">
              {workspaceFolderError}
            </p>
          )}
          <div className="workspace-sidebar__body">
            {workspaceName && (
              <>
                <p className="workspace-name">현재 폴더: {workspaceName}</p>
                <form
                  className="workspace-create"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void createDocument();
                  }}
                >
                  <label htmlFor="new-document-path">새 문서 경로</label>
                  <input
                    id="new-document-path"
                    className="workspace-create__input"
                    value={newDocumentPath}
                    onChange={(event) => setNewDocumentPath(event.target.value)}
                    placeholder="notes/today.md"
                  />
                  <button className="button button--quiet" type="submit">
                    새 문서 생성
                  </button>
                </form>
              </>
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
          </div>
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
          {saveError && (
            <p className="editor-save-error" role="alert">
              {saveError}
            </p>
          )}
          <textarea
            ref={editorRef}
            aria-label="Markdown 편집기"
            className="markdown-editor"
            placeholder="문서를 선택하거나 새 Markdown을 작성하세요."
            value={content}
            onClick={rememberEditorSelection}
            onFocus={rememberEditorSelection}
            onKeyUp={rememberEditorSelection}
            onSelect={rememberEditorSelection}
            onPaste={handleEditorPaste}
            onChange={(event) => {
              setContent(event.target.value);
              editorSelectionRef.current = {
                start: event.target.selectionStart,
                end: event.target.selectionEnd,
              };
              setSaveError('');
            }}
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
