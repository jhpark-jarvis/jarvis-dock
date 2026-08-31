import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent, MouseEvent } from 'react';
import type {
  ImageAssetItem,
  ResearchSearchResult,
  ResearchTabInfo,
  WorkspaceFile,
  WorkspaceEntry,
  DockError,
  RuntimeEventName,
  RuntimeRecordEventRequest,
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
import { renderMermaidDiagram } from './mermaid-preview';
import { getScrollRatio, setScrollRatio } from './preview-scroll';
import {
  findEditorCommandSuggestion,
  type EditorCommand,
  type EditorCommandSuggestion,
} from './editor-commands';
import {
  extractDocumentOutline,
  type DocumentOutlineItem,
} from './document-outline';
import {
  diagnoseMarkdownDocument,
  type DocumentDiagnostic,
} from './document-diagnostics';
import {
  filterWorkspaceFiles,
  searchMarkdownDocuments,
  type WorkspaceSearchResult,
} from './workspace-search';
import {
  DOCUMENT_TEMPLATES,
  getDocumentTemplate,
  type DocumentTemplateId,
} from './document-templates';
import {
  findBacklinks,
  findDocumentLinks,
  type BacklinkResult,
  type DocumentLinkResult,
} from './backlinks';
import { WorkspaceExplorer } from './WorkspaceExplorer';

export type ShellState = 'empty' | 'error' | 'loading';

type DocumentConflict =
  | {
      kind: 'changed';
      relativePath: string;
      externalContent: string;
      externalRevision: string;
    }
  | {
      kind: 'removed';
      relativePath: string;
    };

interface AppProps {
  state?: ShellState;
}

const EmptyStateChip = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="empty-state-chip" aria-live="polite">
    <p className="empty-state-chip__title">{title}</p>
    <p className="empty-state-chip__description">{description}</p>
  </div>
);

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
    <EmptyStateChip
      title="선택된 폴더가 없습니다."
      description="로컬 문서 폴더를 선택하면 Markdown 파일이 여기에 표시됩니다."
    />
  );
};

const documentCreationError = (code: DockError['code']): string => {
  switch (code) {
    case 'WRITE_FAILED':
      return '같은 이름의 문서가 이미 있습니다. 다른 경로 또는 파일명을 입력해 주세요.';
    case 'DIRECTORY_NOT_FOUND':
    case 'NOT_FOUND':
      return '문서를 만들 상위 폴더를 찾을 수 없습니다. 경로를 확인해 주세요.';
    case 'INVALID_NAME':
    case 'INVALID_REQUEST':
      return '문서 경로가 올바르지 않습니다. 파일명과 폴더명을 확인해 주세요.';
    case 'UNSUPPORTED_FILE':
      return 'Markdown 파일(.md 또는 .markdown)만 만들 수 있습니다.';
    case 'PERMISSION_DENIED':
      return '문서를 만들 폴더에 대한 권한이 없습니다.';
    case 'WORKSPACE_NOT_SELECTED':
      return '먼저 문서 폴더를 선택해 주세요.';
    default:
      return '문서를 만들지 못했습니다. 입력을 확인하고 다시 시도해 주세요.';
  }
};

const ExplorerIcon = () => (
  <svg
    aria-hidden="true"
    className="activity-bar__icon"
    viewBox="0 0 24 24"
    focusable="false"
  >
    <path d="M3.75 5.25h6l1.5 2h9v11.5h-16.5z" />
    <path d="M3.75 7.25h16.5" />
  </svg>
);

const OutlineIcon = () => (
  <svg
    aria-hidden="true"
    className="activity-bar__icon"
    viewBox="0 0 24 24"
    focusable="false"
  >
    <path d="M5 6h14M5 12h14M5 18h14" />
    <path d="M2.5 6h.01M2.5 12h.01M2.5 18h.01" strokeWidth="2.5" />
  </svg>
);

const AssetsIcon = () => (
  <svg
    aria-hidden="true"
    className="activity-bar__icon"
    viewBox="0 0 24 24"
    focusable="false"
  >
    <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
    <circle cx="8.5" cy="9" r="1.25" />
    <path d="m5 17 4.5-4.5 3.25 3.25 2.25-2.25L19 17" />
  </svg>
);

const ArchitectureIcon = () => (
  <svg
    aria-hidden="true"
    className="activity-bar__icon"
    viewBox="0 0 24 24"
    focusable="false"
  >
    <circle cx="12" cy="5" r="2.25" />
    <circle cx="5" cy="18" r="2.25" />
    <circle cx="19" cy="18" r="2.25" />
    <path d="M12 7.25v4.5M10.4 12.8 6.7 16M13.6 12.8l3.7 3.2" />
  </svg>
);

const DiagnosticsIcon = () => (
  <svg
    aria-hidden="true"
    className="activity-bar__icon"
    viewBox="0 0 24 24"
    focusable="false"
  >
    <path d="M12 3.5 20 7v5.25c0 4.2-2.8 7.2-8 8.25-5.2-1.05-8-4.05-8-8.25V7z" />
    <path d="M12 8v4.5M12 16h.01" strokeWidth="2.25" />
  </svg>
);

const SearchIcon = () => (
  <svg
    aria-hidden="true"
    className="activity-bar__icon"
    viewBox="0 0 24 24"
    focusable="false"
  >
    <circle cx="10.75" cy="10.75" r="6.25" />
    <path d="m15.5 15.5 4.75 4.75" />
  </svg>
);

const BacklinksIcon = () => (
  <svg
    aria-hidden="true"
    className="activity-bar__icon"
    viewBox="0 0 24 24"
    focusable="false"
  >
    <path d="M9 7.5 7.25 5.75a3.2 3.2 0 0 0-4.5 4.5l2.5 2.5a3.2 3.2 0 0 0 4.5 0L11 11" />
    <path d="m15 16.5 1.75 1.75a3.2 3.2 0 0 0 4.5-4.5l-2.5-2.5a3.2 3.2 0 0 0-4.5 0L13 13" />
    <path d="m8.5 15.5 7-7" />
  </svg>
);

const ARCHITECTURE_FILE_ITEMS = [
  {
    path: 'docs/architecture/arc42.md',
    label: '전체 아키텍처',
    technical: 'arc42',
  },
  {
    path: 'docs/architecture/c4-context.md',
    label: '시스템과 외부 관계',
    technical: 'C4 Context',
  },
  {
    path: 'docs/architecture/c4-container.md',
    label: '주요 애플리케이션 구성',
    technical: 'C4 Container',
  },
  {
    path: 'docs/architecture/c4-component.md',
    label: '구성 내부의 책임',
    technical: 'C4 Component',
  },
  {
    path: 'docs/adr/README.md',
    label: '기술 결정 목록',
    technical: 'ADR Index',
  },
] as const;

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
  const previewRef = useRef<HTMLDivElement>(null);
  const commandTriggerRef = useRef<HTMLButtonElement>(null);
  const documentMessageTimerRef = useRef<number | undefined>(undefined);
  const editorSelectionRef = useRef({ start: 0, end: 0 });
  const workspaceMutationRef = useRef<
    | {
        workspaceId: string;
        sourcePath: string;
      }
    | undefined
  >(undefined);
  const documentScrollRatiosRef = useRef<
    Record<string, { editor: number; preview: number }>
  >({});
  const imageInsertionContextRef = useRef<
    | {
        workspaceId: string;
        selectedPath: string;
        selection: { start: number; end: number };
      }
    | undefined
  >(undefined);
  const expectedRevisionRef = useRef<string | undefined>(undefined);
  const scrollSyncLockRef = useRef<'editor' | 'preview' | undefined>(undefined);
  const editorInputTelemetryRef = useRef<{
    count: number;
    startedAt: number;
    maxLatencyMs: number;
    timer?: number;
  }>({ count: 0, startedAt: 0, maxLatencyMs: 0 });
  const previewRenderDurationRef = useRef(0);
  const previewTelemetryRef = useRef<{
    count: number;
    timer?: number;
  }>({ count: 0 });
  const [state, setState] = useState<ShellState>(initialState);
  const [workspaceId, setWorkspaceId] = useState<string>();
  const [workspaceName, setWorkspaceName] = useState<string>();
  const [workspaceFolderError, setWorkspaceFolderError] = useState('');
  const [workspaceMoveError, setWorkspaceMoveError] = useState('');
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [workspaceEntries, setWorkspaceEntries] = useState<WorkspaceEntry[]>(
    [],
  );
  const [openDocumentPaths, setOpenDocumentPaths] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>();
  const [content, setContent] = useState('');
  const [documentRevision, setDocumentRevision] = useState<string>();
  const [documentConflict, setDocumentConflict] = useState<DocumentConflict>();
  const [documentError, setDocumentError] = useState('');
  const [editorCommandSuggestion, setEditorCommandSuggestion] = useState<
    EditorCommandSuggestion | undefined
  >();
  const [savedContent, setSavedContent] = useState('');
  const [saveError, setSaveError] = useState('');
  const [newDocumentPath, setNewDocumentPath] = useState('untitled.md');
  const [newDocumentTemplate, setNewDocumentTemplate] =
    useState<DocumentTemplateId>('blank');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [activeCommand, setActiveCommand] = useState<
    'link' | 'image' | 'architecture' | 'adr'
  >();
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
    | 'idle'
    | 'searching'
    | 'downloading'
    | 'results'
    | 'empty'
    | 'error'
    | 'selected'
  >('idle');
  const [imageResults, setImageResults] = useState<ImageSearchResult[]>([]);
  const [imageError, setImageError] = useState('');
  const [imageErrorCode, setImageErrorCode] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImageSearchResult>();
  const [imageAltText, setImageAltText] = useState('');
  const [imageThumbnailErrors, setImageThumbnailErrors] = useState<
    Record<string, boolean>
  >({});
  const [architectureProjectName, setArchitectureProjectName] = useState('');
  const [architecturePurpose, setArchitecturePurpose] = useState('');
  const [architectureTechStack, setArchitectureTechStack] = useState('');
  const [architectureStatus, setArchitectureStatus] = useState<
    'idle' | 'creating' | 'error'
  >('idle');
  const [architectureError, setArchitectureError] = useState('');
  const [architectureCheckStatus, setArchitectureCheckStatus] = useState<
    'idle' | 'checking' | 'complete' | 'error'
  >('idle');
  const [architectureCheckPassed, setArchitectureCheckPassed] = useState<
    boolean | undefined
  >();
  const [architectureCheckFiles, setArchitectureCheckFiles] = useState<
    Array<{
      relativePath: string;
      status: 'present' | 'missing' | 'invalid';
      issues: string[];
    }>
  >([]);
  const [adrTitle, setAdrTitle] = useState('');
  const [adrStatus, setAdrStatus] = useState<
    'Proposed' | 'Accepted' | 'Rejected' | 'Superseded'
  >('Proposed');
  const [adrContext, setAdrContext] = useState('');
  const [adrDecision, setAdrDecision] = useState('');
  const [adrConsequences, setAdrConsequences] = useState('');
  const [adrCreateStatus, setAdrCreateStatus] = useState<
    'idle' | 'creating' | 'error'
  >('idle');
  const [adrError, setAdrError] = useState('');
  const [previewImageSources, setPreviewImageSources] = useState<
    Record<string, string>
  >({});
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(true);
  const [mermaidRenders, setMermaidRenders] = useState<
    Record<number, { source: string; svg?: string; error?: string }>
  >({});
  const [assets, setAssets] = useState<ImageAssetItem[]>([]);
  const [assetSources, setAssetSources] = useState<Record<string, string>>({});
  const [assetStatus, setAssetStatus] = useState<'idle' | 'loading' | 'error'>(
    'idle',
  );
  const [assetRefreshKey, setAssetRefreshKey] = useState(0);
  const [diagnosticAssetPaths, setDiagnosticAssetPaths] = useState<Set<string>>(
    new Set(),
  );
  const [diagnosticsStatus, setDiagnosticsStatus] = useState<
    'idle' | 'loading' | 'error'
  >('idle');
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('');
  const [workspaceSearchStatus, setWorkspaceSearchStatus] = useState<
    'idle' | 'loading'
  >('idle');
  const [workspaceSearchResults, setWorkspaceSearchResults] = useState<
    WorkspaceSearchResult[]
  >([]);
  const [backlinkStatus, setBacklinkStatus] = useState<'idle' | 'loading'>(
    'idle',
  );
  const [backlinkResults, setBacklinkResults] = useState<BacklinkResult[]>([]);
  const [workspacePanel, setWorkspacePanel] = useState<
    | 'explorer'
    | 'search'
    | 'backlinks'
    | 'outline'
    | 'assets'
    | 'architecture'
    | 'diagnostics'
    | undefined
  >('explorer');

  const recordRuntimeEvent = useCallback(
    (
      event: RuntimeEventName,
      details?: RuntimeRecordEventRequest['details'],
    ) => {
      const recordEvent = window.dock?.runtime?.recordEvent;
      if (!recordEvent) return;
      void recordEvent({ event, details }).catch(() => undefined);
    },
    [],
  );

  const scheduleEditorInputTelemetry = (bytes: number) => {
    const telemetry = editorInputTelemetryRef.current;
    if (telemetry.count === 0) {
      telemetry.startedAt = performance.now();
      telemetry.maxLatencyMs = 0;
    }
    telemetry.count += 1;
    if (telemetry.timer !== undefined) window.clearTimeout(telemetry.timer);
    const inputStartedAt = performance.now();
    window.requestAnimationFrame(() => {
      telemetry.maxLatencyMs = Math.max(
        telemetry.maxLatencyMs,
        performance.now() - inputStartedAt,
      );
    });
    telemetry.timer = window.setTimeout(() => {
      recordRuntimeEvent('editor-input-burst', {
        bytes,
        count: telemetry.count,
        durationMs: performance.now() - telemetry.startedAt,
        latencyMs: telemetry.maxLatencyMs,
        outcome: 'success',
      });
      telemetry.count = 0;
      telemetry.startedAt = 0;
      telemetry.maxLatencyMs = 0;
      telemetry.timer = undefined;
    }, 750);
  };

  const showTransientDocumentMessage = (message: string) => {
    if (documentMessageTimerRef.current !== undefined) {
      window.clearTimeout(documentMessageTimerRef.current);
    }
    setDocumentError(message);
    documentMessageTimerRef.current = window.setTimeout(() => {
      setDocumentError('');
      documentMessageTimerRef.current = undefined;
    }, 2500);
  };

  const rememberDocumentScrollPosition = (path = selectedPath) => {
    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!path || !editor || !preview) return;
    documentScrollRatiosRef.current[path] = {
      editor: getScrollRatio(editor),
      preview: getScrollRatio(preview),
    };
  };

  const restoreEditorPosition = (
    selection = editorSelectionRef.current,
    scrollTop?: number,
  ) => {
    const nextSelection = { ...selection };
    const applyPosition = () => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      editor.setSelectionRange(nextSelection.start, nextSelection.end);
      if (scrollTop !== undefined) editor.scrollTop = scrollTop;
    };
    window.setTimeout(() => {
      window.requestAnimationFrame(applyPosition);
    }, 0);
  };

  useEffect(
    () => () => {
      if (documentMessageTimerRef.current !== undefined)
        window.clearTimeout(documentMessageTimerRef.current);
      if (editorInputTelemetryRef.current.timer !== undefined)
        window.clearTimeout(editorInputTelemetryRef.current.timer);
      if (previewTelemetryRef.current.timer !== undefined)
        window.clearTimeout(previewTelemetryRef.current.timer);
    },
    [],
  );

  useEffect(() => {
    if (!workspaceMoveError) return;
    const timer = window.setTimeout(() => setWorkspaceMoveError(''), 4500);
    return () => window.clearTimeout(timer);
  }, [workspaceMoveError]);

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
    setWorkspaceEntries([
      { relativePath: 'guide.md', displayName: 'guide.md', kind: 'file' },
    ]);
    setOpenDocumentPaths(['guide.md']);
    setSelectedPath('guide.md');
    setContent('# Start');
    setSavedContent('# Start');
    setDocumentError('');
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
      const loadedSources = sources.filter(Boolean);
      setPreviewImageSources(Object.fromEntries(loadedSources));
      if (assetPaths.length > 0) {
        recordRuntimeEvent('image-loaded', {
          count: loadedSources.length,
          outcome:
            loadedSources.length === assetPaths.length ? 'success' : 'failure',
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [content, recordRuntimeEvent, selectedPath, workspaceId]);

  useEffect(() => {
    let cancelled = false;
    if (!workspaceId || workspacePanel !== 'assets') {
      setAssets([]);
      setAssetSources({});
      setAssetStatus('idle');
      return () => {
        cancelled = true;
      };
    }

    setAssetStatus('loading');
    void window.dock.image
      .list({ workspaceId })
      .then(async (response) => {
        if (cancelled) return;
        if (response.ok === false) {
          setAssets([]);
          setAssetSources({});
          setAssetStatus('error');
          return;
        }
        setAssets(response.value.assets);
        const sources = await Promise.all(
          response.value.assets.map(async (asset) => {
            try {
              const image = await window.dock.image.read({
                workspaceId,
                assetPath: asset.assetPath,
              });
              return image.ok
                ? ([asset.assetPath, image.value.dataUrl] as const)
                : null;
            } catch {
              return null;
            }
          }),
        );
        if (cancelled) return;
        setAssetSources(Object.fromEntries(sources.filter(Boolean)));
        setAssetStatus('idle');
      })
      .catch(() => {
        if (cancelled) return;
        setAssets([]);
        setAssetSources({});
        setAssetStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [assetRefreshKey, workspaceId, workspacePanel]);

  useEffect(() => {
    let cancelled = false;
    const query = workspaceSearchQuery.trim();
    if (!workspaceId || workspacePanel !== 'search' || !query) {
      setWorkspaceSearchResults([]);
      setWorkspaceSearchStatus('idle');
      return () => {
        cancelled = true;
      };
    }

    setWorkspaceSearchStatus('loading');
    void Promise.all(
      files.map(async (file) => {
        try {
          const response = await window.dock.document.read({
            workspaceId,
            relativePath: file.relativePath,
          });
          return response.ok
            ? {
                relativePath: file.relativePath,
                content: response.value.content,
              }
            : null;
        } catch {
          return null;
        }
      }),
    ).then((documents) => {
      if (cancelled) return;
      setWorkspaceSearchResults(
        searchMarkdownDocuments(documents.filter(Boolean), query),
      );
      setWorkspaceSearchStatus('idle');
    });

    return () => {
      cancelled = true;
    };
  }, [files, workspaceId, workspacePanel, workspaceSearchQuery]);

  useEffect(() => {
    let cancelled = false;
    if (!workspaceId || workspacePanel !== 'backlinks' || !selectedPath) {
      setBacklinkResults([]);
      setBacklinkStatus('idle');
      return () => {
        cancelled = true;
      };
    }

    setBacklinkStatus('loading');
    void Promise.all(
      files.map(async (file) => {
        try {
          const response = await window.dock.document.read({
            workspaceId,
            relativePath: file.relativePath,
          });
          return response.ok
            ? {
                relativePath: file.relativePath,
                content: response.value.content,
              }
            : null;
        } catch {
          return null;
        }
      }),
    ).then((documents) => {
      if (cancelled) return;
      setBacklinkResults(
        findBacklinks(documents.filter(Boolean), selectedPath),
      );
      setBacklinkStatus('idle');
    });

    return () => {
      cancelled = true;
    };
  }, [files, selectedPath, workspaceId, workspacePanel]);

  useEffect(() => {
    let cancelled = false;
    if (!workspaceId || workspacePanel !== 'diagnostics') {
      setDiagnosticAssetPaths(new Set());
      setDiagnosticsStatus('idle');
      return () => {
        cancelled = true;
      };
    }

    setDiagnosticsStatus('loading');
    void window.dock.image
      .list({ workspaceId })
      .then((response) => {
        if (cancelled) return;
        if (response.ok === false) {
          setDiagnosticAssetPaths(new Set());
          setDiagnosticsStatus('error');
          return;
        }
        setDiagnosticAssetPaths(
          new Set(response.value.assets.map((asset) => asset.assetPath)),
        );
        setDiagnosticsStatus('idle');
      })
      .catch(() => {
        if (cancelled) return;
        setDiagnosticAssetPaths(new Set());
        setDiagnosticsStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [assetRefreshKey, workspaceId, workspacePanel]);

  const refreshFiles = useCallback(
    async (nextWorkspaceId: string) => {
      let files: WorkspaceFile[];
      let entries: WorkspaceEntry[];
      if (window.dock.workspace.listEntries) {
        const listedEntries = await window.dock.workspace.listEntries({
          workspaceId: nextWorkspaceId,
        });
        if (!listedEntries.ok) {
          setState('error');
          return false;
        }
        entries = listedEntries.value.entries;
        files = entries
          .filter(
            (entry) =>
              entry.kind === 'file' &&
              /\.(md|markdown)$/i.test(entry.displayName),
          )
          .map(({ relativePath, displayName }) => ({
            relativePath,
            displayName,
          }));
      } else {
        const listed = await window.dock.workspace.listMarkdownFiles({
          workspaceId: nextWorkspaceId,
        });
        if (!listed.ok) {
          setState('error');
          return false;
        }
        files = listed.value.files;
        entries = files.map((file) => ({
          ...file,
          kind: 'file' as const,
        }));
      }
      setFiles(files);
      setWorkspaceEntries(entries);
      recordRuntimeEvent('workspace-refreshed', {
        count: entries.length,
        outcome: 'success',
      });
      return { files, entries };
    },
    [recordRuntimeEvent],
  );

  const handleWorkspaceChanged = useCallback(
    async (changedWorkspaceId: string) => {
      if (workspaceMutationRef.current?.workspaceId === changedWorkspaceId)
        return;
      const refreshed = await refreshFiles(changedWorkspaceId);
      if (workspaceMutationRef.current?.workspaceId === changedWorkspaceId)
        return;
      if (!refreshed || changedWorkspaceId !== workspaceId || !selectedPath)
        return;

      const selectedFile = refreshed.files.some(
        (file) => file.relativePath === selectedPath,
      );
      if (!selectedFile) {
        if (content !== savedContent) {
          setDocumentConflict({
            kind: 'removed',
            relativePath: selectedPath,
          });
          return;
        }
        setOpenDocumentPaths((current) =>
          current.filter((path) => path !== selectedPath),
        );
        setSelectedPath(undefined);
        setContent('');
        setSavedContent('');
        setDocumentRevision(undefined);
        setDocumentError('외부 변경으로 현재 문서가 닫혔습니다.');
        setDocumentConflict(undefined);
        editorSelectionRef.current = { start: 0, end: 0 };
        return;
      }

      const current = await window.dock.document.read({
        workspaceId: changedWorkspaceId,
        relativePath: selectedPath,
      });
      if (!current.ok || current.value.revision === documentRevision) return;
      if (current.value.revision === expectedRevisionRef.current) {
        expectedRevisionRef.current = undefined;
        return;
      }
      if (content !== savedContent) {
        setDocumentConflict({
          kind: 'changed',
          relativePath: selectedPath,
          externalContent: current.value.content,
          externalRevision: current.value.revision,
        });
        return;
      }
      setContent(current.value.content);
      setSavedContent(current.value.content);
      setDocumentRevision(current.value.revision);
      setDocumentError('');
      editorSelectionRef.current = {
        start: current.value.content.length,
        end: current.value.content.length,
      };
    },
    [
      content,
      documentRevision,
      refreshFiles,
      savedContent,
      selectedPath,
      workspaceId,
    ],
  );

  useEffect(() => {
    if (!workspaceId || !window.dock.workspace.onChanged) return;
    return window.dock.workspace.onChanged((event) => {
      if (event.workspaceId === workspaceId)
        void handleWorkspaceChanged(workspaceId);
    });
  }, [handleWorkspaceChanged, workspaceId]);

  const chooseWorkspace = async () => {
    setState('loading');
    const chosen = await window.dock.workspace.choose();
    if (chosen.ok === false) {
      setState(chosen.error.code === 'CANCELLED' ? 'empty' : 'error');
      return;
    }
    setWorkspaceId(chosen.value.workspaceId);
    setWorkspaceName(chosen.value.displayName);
    setOpenDocumentPaths([]);
    setWorkspaceEntries([]);
    setSelectedPath(undefined);
    setContent('');
    setDocumentRevision(undefined);
    setDocumentConflict(undefined);
    expectedRevisionRef.current = undefined;
    setSavedContent('');
    setDocumentError('');
    setSaveError('');
    setAssets([]);
    setAssetSources({});
    setAssetStatus('idle');
    setWorkspaceFolderError('');
    setWorkspaceSearchQuery('');
    setWorkspaceSearchResults([]);
    setWorkspaceSearchStatus('idle');
    const refreshed = await refreshFiles(chosen.value.workspaceId);
    if (!refreshed) return;
    recordRuntimeEvent('workspace-selected', {
      count: refreshed.entries.length,
      outcome: 'success',
    });
    setState('empty');
  };

  const createWorkspaceEntry = async (
    parentPath: string,
    kind: 'file' | 'directory',
    name: string,
  ): Promise<boolean> => {
    if (!workspaceId || !window.dock.workspace.createEntry) {
      setWorkspaceFolderError('먼저 문서 폴더를 선택해 주세요.');
      return false;
    }
    try {
      const result = await window.dock.workspace.createEntry({
        workspaceId,
        parentPath,
        name,
        kind,
      });
      if (result.ok === false) {
        setWorkspaceFolderError(
          result.error.code === 'WRITE_FAILED'
            ? '같은 이름의 파일 또는 폴더가 이미 있습니다.'
            : result.error.code === 'DIRECTORY_NOT_FOUND'
              ? '파일 또는 폴더를 만들 상위 폴더를 찾을 수 없습니다.'
              : result.error.message,
        );
        return false;
      }
      setWorkspaceFolderError('');
      if (!(await refreshFiles(workspaceId))) return false;
      if (kind === 'file') await openDocument(result.value.relativePath);
      return true;
    } catch {
      setWorkspaceFolderError(
        '파일 또는 폴더를 만들지 못했습니다. 다시 시도해 주세요.',
      );
      return false;
    }
  };

  const renameWorkspaceEntry = async (
    relativePath: string,
    newName: string,
  ): Promise<boolean> => {
    if (!workspaceId || !window.dock.workspace.renameEntry) return false;
    const oldPrefix = `${relativePath}/`;
    const shouldRestoreEditorFocus = Boolean(
      selectedPath &&
      (selectedPath === relativePath || selectedPath.startsWith(oldPrefix)),
    );
    const editorScrollTop = editorRef.current?.scrollTop;
    const editorSelection = { ...editorSelectionRef.current };
    const mutation = {
      workspaceId,
      sourcePath: relativePath,
    };
    workspaceMutationRef.current = mutation;
    setWorkspaceFolderError('');
    try {
      const result = await window.dock.workspace.renameEntry({
        workspaceId,
        relativePath,
        newName,
      });
      if (result.ok === false) {
        setWorkspaceFolderError(result.error.message);
        return false;
      }
      const newPrefix = `${result.value.relativePath}/`;
      const movePath = (value: string) =>
        value === relativePath
          ? result.value.relativePath
          : value.startsWith(oldPrefix)
            ? `${newPrefix}${value.slice(oldPrefix.length)}`
            : value;
      setOpenDocumentPaths((current) => current.map(movePath));
      setSelectedPath((current) => (current ? movePath(current) : current));
      if (selectedPath) {
        const moved = movePath(selectedPath);
        if (moved !== selectedPath) setSelectedPath(moved);
      }
      setWorkspaceFolderError('');
      const refreshed = Boolean(await refreshFiles(workspaceId));
      if (refreshed && shouldRestoreEditorFocus) {
        restoreEditorPosition(editorSelection, editorScrollTop);
      }
      return refreshed;
    } catch {
      setWorkspaceFolderError(
        '파일 또는 폴더 이름을 변경하지 못했습니다. 다시 시도해 주세요.',
      );
      return false;
    } finally {
      window.setTimeout(() => {
        if (workspaceMutationRef.current === mutation)
          workspaceMutationRef.current = undefined;
      }, 100);
    }
  };

  const moveWorkspaceEntry = async (
    relativePath: string,
    destinationParentPath: string,
  ): Promise<boolean> => {
    if (!workspaceId || !window.dock.workspace.moveEntry) {
      setWorkspaceMoveError('먼저 문서 폴더를 선택해 주세요.');
      return false;
    }
    setWorkspaceFolderError('');
    setWorkspaceMoveError('');
    const mutation = {
      workspaceId,
      sourcePath: relativePath,
    };
    workspaceMutationRef.current = mutation;
    try {
      const result = await window.dock.workspace.moveEntry({
        workspaceId,
        relativePath,
        destinationParentPath,
      });
      if (result.ok === false) {
        setWorkspaceMoveError(
          result.error.code === 'WRITE_FAILED'
            ? '대상 폴더에 같은 이름의 파일 또는 폴더가 이미 있습니다.'
            : result.error.code === 'DIRECTORY_NOT_FOUND'
              ? '파일 또는 폴더를 이동할 대상 폴더를 찾을 수 없습니다.'
              : result.error.code === 'INVALID_REQUEST'
                ? '폴더를 자기 자신이나 내부 폴더로 이동할 수 없습니다.'
                : result.error.message,
        );
        return false;
      }
      const oldPrefix = `${relativePath}/`;
      const newPrefix = `${result.value.relativePath}/`;
      const movePath = (value: string) =>
        value === relativePath
          ? result.value.relativePath
          : value.startsWith(oldPrefix)
            ? `${newPrefix}${value.slice(oldPrefix.length)}`
            : value;
      setOpenDocumentPaths((current) => current.map(movePath));
      setSelectedPath((current) => (current ? movePath(current) : current));
      setWorkspaceFolderError('');
      setWorkspaceMoveError('');
      return Boolean(await refreshFiles(workspaceId));
    } catch {
      setWorkspaceMoveError(
        '파일 또는 폴더를 이동하지 못했습니다. 다시 시도해 주세요.',
      );
      return false;
    } finally {
      window.setTimeout(() => {
        if (workspaceMutationRef.current === mutation)
          workspaceMutationRef.current = undefined;
      }, 100);
    }
  };

  const deleteWorkspaceEntry = async (relativePath: string) => {
    if (!workspaceId || !window.dock.workspace.deleteEntry) return;
    const isSelected =
      selectedPath === relativePath ||
      selectedPath?.startsWith(`${relativePath}/`);
    if (
      isSelected &&
      content !== savedContent &&
      !window.confirm('저장하지 않은 변경 사항이 있습니다. 그래도 삭제할까요?')
    )
      return;
    const result = await window.dock.workspace.deleteEntry({
      workspaceId,
      relativePath,
    });
    if (result.ok === false) {
      setWorkspaceFolderError(result.error.message);
      return;
    }
    setOpenDocumentPaths((current) =>
      current.filter(
        (value) =>
          value !== relativePath && !value.startsWith(`${relativePath}/`),
      ),
    );
    if (isSelected) {
      setSelectedPath(undefined);
      setContent('');
      setSavedContent('');
      setDocumentRevision(undefined);
      setDocumentConflict(undefined);
      editorSelectionRef.current = { start: 0, end: 0 };
    }
    setWorkspaceFolderError('');
    await refreshFiles(workspaceId);
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
    if (!workspaceId) {
      setDocumentError('먼저 문서 폴더를 선택해 주세요.');
      return;
    }
    if (
      selectedPath &&
      selectedPath !== relativePath &&
      content !== savedContent &&
      !window.confirm('저장하지 않은 변경 사항이 있습니다. 다른 문서를 열까요?')
    ) {
      restoreEditorPosition();
      return;
    }
    if (selectedPath && selectedPath !== relativePath) {
      rememberDocumentScrollPosition(selectedPath);
    }
    try {
      const result = await window.dock.document.read({
        workspaceId,
        relativePath,
      });
      if (result.ok === false) {
        setDocumentError(
          '문서를 열지 못했습니다. 파일이 존재하고 Markdown 파일인지 확인해 주세요.',
        );
        return;
      }
      setDocumentError('');
      setDocumentConflict(undefined);
      setOpenDocumentPaths((current) =>
        current.includes(relativePath) ? current : [...current, relativePath],
      );
      setSelectedPath(relativePath);
      setContent(result.value.content);
      setSavedContent(result.value.content);
      setDocumentRevision(result.value.revision);
      expectedRevisionRef.current = undefined;
      editorSelectionRef.current = {
        start: result.value.content.length,
        end: result.value.content.length,
      };
      setSaveError('');
      recordRuntimeEvent('document-opened', {
        bytes: result.value.content.length,
        outcome: 'success',
      });
    } catch {
      setDocumentError(
        '문서를 열지 못했습니다. 파일이 존재하고 Markdown 파일인지 확인해 주세요.',
      );
    }
  };

  const closeDocumentTab = async (relativePath: string) => {
    if (
      relativePath === selectedPath &&
      content !== savedContent &&
      !window.confirm('저장하지 않은 변경 사항을 버리고 문서를 닫을까요?')
    ) {
      restoreEditorPosition();
      return;
    }
    const remainingPaths = openDocumentPaths.filter(
      (path) => path !== relativePath,
    );
    setOpenDocumentPaths(remainingPaths);
    if (relativePath !== selectedPath) return;
    const nextPath = remainingPaths.at(-1);
    if (nextPath) {
      await openDocument(nextPath);
      return;
    }
    setSelectedPath(undefined);
    setContent('');
    setSavedContent('');
    setDocumentRevision(undefined);
    setDocumentConflict(undefined);
    setDocumentError('');
    editorSelectionRef.current = { start: 0, end: 0 };
    setSaveError('');
  };

  const saveDocument = async (force = false) => {
    if (!workspaceId || !selectedPath) return;
    const conflictKind = documentConflict?.kind;
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
    if (force && conflictKind === 'removed') {
      const recreated = await window.dock.document.create({
        workspaceId,
        relativePath: selectedPath,
      });
      if (!recreated.ok) {
        setSaveError('문서를 다시 만들지 못했습니다. 편집 내용은 유지됩니다.');
        return;
      }
    }
    const saveStartedAt = performance.now();
    const result = await window.dock.document.write({
      workspaceId,
      relativePath: selectedPath,
      content,
      ...(!force && documentRevision
        ? { expectedRevision: documentRevision }
        : {}),
    });
    if (result.ok) {
      expectedRevisionRef.current = result.value.revision;
      setSavedContent(content);
      setDocumentRevision(result.value.revision);
      setDocumentConflict(undefined);
      setDocumentError('');
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
      recordRuntimeEvent('document-saved', {
        bytes: content.length,
        durationMs: performance.now() - saveStartedAt,
        outcome: 'success',
      });
    } else {
      recordRuntimeEvent('document-save-failed', {
        durationMs: performance.now() - saveStartedAt,
        outcome: 'failure',
      });
      setSaveError(
        result.ok === false && result.error.code === 'WRITE_CONFLICT'
          ? '문서가 외부에서 변경되었습니다. 다시 불러온 뒤 저장해 주세요.'
          : '문서를 저장하지 못했습니다. 편집 내용은 유지됩니다.',
      );
    }
  };

  const reloadExternalDocument = () => {
    if (!documentConflict || documentConflict.kind !== 'changed') return;
    expectedRevisionRef.current = undefined;
    setContent(documentConflict.externalContent);
    setSavedContent(documentConflict.externalContent);
    setDocumentRevision(documentConflict.externalRevision);
    setDocumentConflict(undefined);
    showTransientDocumentMessage('외부 변경 내용을 불러왔습니다.');
    setSaveError('');
    editorSelectionRef.current = {
      start: documentConflict.externalContent.length,
      end: documentConflict.externalContent.length,
    };
  };

  const closeConflictedDocument = () => {
    if (!selectedPath) return;
    expectedRevisionRef.current = undefined;
    setOpenDocumentPaths((current) =>
      current.filter((path) => path !== selectedPath),
    );
    setSelectedPath(undefined);
    setContent('');
    setSavedContent('');
    setDocumentRevision(undefined);
    setDocumentConflict(undefined);
    setDocumentError('');
    setSaveError('');
    editorSelectionRef.current = { start: 0, end: 0 };
  };

  const createDocument = async () => {
    if (!workspaceId) {
      setDocumentError('먼저 문서 폴더를 선택해 주세요.');
      return;
    }
    const relativePath = newDocumentPath.trim();
    if (!relativePath) {
      setDocumentError('새 문서 경로를 입력해 주세요.');
      return;
    }
    setState('loading');
    setDocumentError('');
    try {
      const result = await window.dock.document.create({
        workspaceId,
        relativePath,
      });
      if (result.ok === false) {
        setDocumentError(
          documentCreationError(
            'error' in result ? result.error.code : 'INTERNAL',
          ),
        );
        setState('empty');
        return;
      }
      const templateContent = getDocumentTemplate(newDocumentTemplate);
      let createdRevision = result.value.revision;
      if (templateContent) {
        const written = await window.dock.document.write({
          workspaceId,
          relativePath,
          content: templateContent,
        });
        if (written.ok === false) {
          setDocumentError(documentCreationError(written.error.code));
          setState('empty');
          return;
        }
        createdRevision = written.value.revision;
      }
      if (!(await refreshFiles(workspaceId))) {
        setDocumentError('문서는 만들었지만 문서 목록을 갱신하지 못했습니다.');
        return;
      }
      setOpenDocumentPaths((current) =>
        current.includes(relativePath) ? current : [...current, relativePath],
      );
      setSelectedPath(relativePath);
      setContent(templateContent);
      setSavedContent(templateContent);
      setDocumentRevision(createdRevision);
      setDocumentConflict(undefined);
      setDocumentError('');
      editorSelectionRef.current = {
        start: templateContent.length,
        end: templateContent.length,
      };
      setSaveError('');
      setNewDocumentPath('');
      setNewDocumentTemplate('blank');
      setState('empty');
    } catch {
      setDocumentError(
        '문서를 만들지 못했습니다. 입력을 확인하고 다시 시도해 주세요.',
      );
      setState('empty');
    }
  };

  const dirty = content !== savedContent;
  const documentDiagnostics: DocumentDiagnostic[] = selectedPath
    ? diagnoseMarkdownDocument({
        documentPath: selectedPath,
        content,
        workspacePaths: new Set(files.map((file) => file.relativePath)),
        assetPaths: diagnosticAssetPaths,
        mermaidRenders,
      })
    : [];
  const quickOpenFiles = filterWorkspaceFiles(files, workspaceSearchQuery);
  const documentLinks: DocumentLinkResult[] = selectedPath
    ? findDocumentLinks(
        { relativePath: selectedPath, content },
        new Set(files.map((file) => file.relativePath)),
      )
    : [];
  const previewStartedAt = performance.now();
  const previewHtml = selectedPath
    ? renderMarkdownPreview(content, {
        documentPath: selectedPath,
        imageSources: previewImageSources,
        mermaidRenders,
      })
    : '';
  previewRenderDurationRef.current = selectedPath
    ? performance.now() - previewStartedAt
    : 0;

  useEffect(() => {
    const telemetry = previewTelemetryRef.current;
    if (!selectedPath) {
      if (telemetry.timer !== undefined) window.clearTimeout(telemetry.timer);
      telemetry.count = 0;
      telemetry.timer = undefined;
      return;
    }
    telemetry.count += 1;
    if (telemetry.timer !== undefined) window.clearTimeout(telemetry.timer);
    telemetry.timer = window.setTimeout(() => {
      recordRuntimeEvent('preview-rendered', {
        bytes: content.length,
        count: telemetry.count,
        durationMs: previewRenderDurationRef.current,
        outcome: 'success',
      });
      telemetry.count = 0;
      telemetry.timer = undefined;
    }, 750);
  }, [content, recordRuntimeEvent, selectedPath]);

  useEffect(() => {
    if (!selectedPath) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const root = previewRef.current;
      if (!root) return;
      const blocks = Array.from(
        root.querySelectorAll<HTMLElement>('.mermaid-block'),
      );
      void Promise.all(
        blocks.map(async (block, index) => {
          const source =
            block.querySelector('.mermaid-source')?.textContent ??
            block.querySelector('details pre code')?.textContent ??
            '';
          const existingRender = mermaidRenders[index];
          if (existingRender?.source === source) return;
          if (!source.trim()) {
            setMermaidRenders((current) => ({
              ...current,
              [index]: {
                source,
                error:
                  'Mermaid 미리보기를 생성하지 못했습니다. 원문이 비어 있습니다.',
              },
            }));
            return;
          }
          const mermaidStartedAt = performance.now();
          try {
            const svg = await renderMermaidDiagram(source);
            if (cancelled) return;
            setMermaidRenders((current) => ({
              ...current,
              [index]: { source, svg },
            }));
            recordRuntimeEvent('mermaid-rendered', {
              durationMs: performance.now() - mermaidStartedAt,
              outcome: 'success',
            });
          } catch {
            if (cancelled) return;
            setMermaidRenders((current) => ({
              ...current,
              [index]: {
                source,
                error:
                  'Mermaid 미리보기를 생성하지 못했습니다. 원문을 확인해 주세요.',
              },
            }));
            recordRuntimeEvent('mermaid-rendered', {
              durationMs: performance.now() - mermaidStartedAt,
              outcome: 'failure',
            });
          }
        }),
      );
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [previewHtml, recordRuntimeEvent, selectedPath, mermaidRenders]);

  useEffect(() => {
    if (!selectedPath) return;
    const position = documentScrollRatiosRef.current[selectedPath];
    if (!position) return;
    const frame = requestAnimationFrame(() => {
      const editor = editorRef.current;
      const preview = previewRef.current;
      if (!editor || !preview) return;
      setScrollRatio(editor, position.editor);
      setScrollRatio(preview, position.preview);
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedPath]);

  useEffect(() => {
    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    let unlockTimer: number | undefined;
    const lockTarget = (target: 'editor' | 'preview') => {
      scrollSyncLockRef.current = target;
      if (unlockTimer !== undefined) window.clearTimeout(unlockTimer);
      unlockTimer = window.setTimeout(() => {
        if (scrollSyncLockRef.current === target) {
          scrollSyncLockRef.current = undefined;
        }
      }, 0);
    };

    const handleEditorScroll = () => {
      const ratio = getScrollRatio(editor);
      if (selectedPath) {
        documentScrollRatiosRef.current[selectedPath] = {
          editor: ratio,
          preview: scrollSyncEnabled ? ratio : getScrollRatio(preview),
        };
      }
      if (!scrollSyncEnabled) return;
      if (scrollSyncLockRef.current === 'editor') {
        scrollSyncLockRef.current = undefined;
        return;
      }
      lockTarget('preview');
      setScrollRatio(preview, ratio);
    };
    const handlePreviewScroll = () => {
      const ratio = getScrollRatio(preview);
      if (selectedPath) {
        documentScrollRatiosRef.current[selectedPath] = {
          editor: scrollSyncEnabled ? ratio : getScrollRatio(editor),
          preview: ratio,
        };
      }
      if (!scrollSyncEnabled) return;
      if (scrollSyncLockRef.current === 'preview') {
        scrollSyncLockRef.current = undefined;
        return;
      }
      lockTarget('editor');
      setScrollRatio(editor, ratio);
    };

    editor.addEventListener('scroll', handleEditorScroll);
    preview.addEventListener('scroll', handlePreviewScroll);
    return () => {
      editor.removeEventListener('scroll', handleEditorScroll);
      preview.removeEventListener('scroll', handlePreviewScroll);
      if (unlockTimer !== undefined) window.clearTimeout(unlockTimer);
      scrollSyncLockRef.current = undefined;
    };
  }, [scrollSyncEnabled, selectedPath]);
  const outlineItems = extractDocumentOutline(content);

  const rememberEditorSelection = () => {
    const editor = editorRef.current;
    if (!editor) return editorSelectionRef.current;
    editorSelectionRef.current = {
      start: editor.selectionStart,
      end: editor.selectionEnd,
    };
    setEditorCommandSuggestion(
      editor.selectionStart === editor.selectionEnd
        ? findEditorCommandSuggestion(content, editor.selectionStart)
        : undefined,
    );
    return editorSelectionRef.current;
  };

  const moveEditorToLine = (line: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    let lineStart = 0;
    for (let currentLine = 1; currentLine < line; currentLine += 1) {
      const newlineIndex = content.indexOf('\n', lineStart);
      if (newlineIndex < 0) {
        lineStart = content.length;
        break;
      }
      lineStart = newlineIndex + 1;
    }
    editor.focus();
    editor.setSelectionRange(lineStart, lineStart);
    editorSelectionRef.current = { start: lineStart, end: lineStart };
  };

  const moveEditorToOutlineItem = (item: DocumentOutlineItem) => {
    moveEditorToLine(item.line + 1);
  };

  const explorerOpen = workspacePanel === 'explorer';
  const architectureFileItems = [
    ...ARCHITECTURE_FILE_ITEMS,
    ...files
      .filter(
        (file) =>
          file.relativePath.startsWith('docs/adr/') &&
          file.relativePath !== 'docs/adr/README.md',
      )
      .map((file) => ({
        path: file.relativePath,
        label: `ADR ${file.displayName.replace(/\.md$/i, '')}`,
        technical: 'Architecture Decision Record',
      })),
  ];

  const setResearchViewVisibility = useCallback(
    (visible: boolean) => {
      if (!researchOpen) return;
      const setVisible = window.dock?.research?.setVisible;
      if (!setVisible) return;
      void setVisible({ visible });
    },
    [researchOpen],
  );

  useEffect(() => {
    if (!researchOpen) return;
    setResearchViewVisibility(!commandPaletteOpen);
  }, [commandPaletteOpen, researchOpen, setResearchViewVisibility]);

  const resetArchitectureDraft = () => {
    setArchitectureProjectName('');
    setArchitecturePurpose('');
    setArchitectureTechStack('');
  };

  const resetAdrDraft = () => {
    setAdrTitle('');
    setAdrStatus('Proposed');
    setAdrContext('');
    setAdrDecision('');
    setAdrConsequences('');
  };

  /*
   * The Research View is a native child view, so the Renderer dialog cannot
   * cover it with z-index alone. Keep its native visibility aligned with the
   * dialog state and restore it after an async Research open completes.
   */
  const openCommandPalette = (selection?: { start: number; end: number }) => {
    const capturedSelection = selection ?? rememberEditorSelection();
    if (workspaceId && selectedPath) {
      imageInsertionContextRef.current = {
        workspaceId,
        selectedPath,
        selection: capturedSelection,
      };
    } else {
      imageInsertionContextRef.current = undefined;
    }
    setEditorCommandSuggestion(undefined);
    setResearchViewVisibility(false);
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
    setArchitectureStatus('idle');
    setArchitectureError('');
    setArchitectureCheckStatus('idle');
    setArchitectureCheckPassed(undefined);
    setArchitectureCheckFiles([]);
    setAdrCreateStatus('idle');
    setAdrError('');
    setCommandPaletteOpen(true);
  };

  const activateEditorCommand = (command: EditorCommand) => {
    const suggestion = editorCommandSuggestion;
    if (!suggestion || suggestion.command !== command) return;
    const nextContent =
      content.slice(0, suggestion.start) + content.slice(suggestion.end);
    const selection = { start: suggestion.start, end: suggestion.start };
    setContent(nextContent);
    editorSelectionRef.current = selection;
    setEditorCommandSuggestion(undefined);
    openCommandPalette(selection);
    setActiveCommand(command);
    if (command === 'link') {
      setLinkStatus('search');
    } else {
      setImageStatus('idle');
    }
  };

  const openArchitectureInitializer = () => {
    openCommandPalette();
    setActiveCommand('architecture');
  };

  const openAdrComposer = () => {
    openCommandPalette();
    setActiveCommand('adr');
  };

  const closeCommandPalette = () => {
    setResearchViewVisibility(true);
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
    setArchitectureStatus('idle');
    setArchitectureError('');
    setArchitectureCheckStatus('idle');
    setArchitectureCheckPassed(undefined);
    setArchitectureCheckFiles([]);
    setAdrCreateStatus('idle');
    setAdrError('');
    commandTriggerRef.current?.focus();
  };

  const createArchitectureWorkspace = async () => {
    if (!workspaceId) {
      setArchitectureError('먼저 문서 폴더를 선택해 주세요.');
      setArchitectureStatus('error');
      return;
    }
    setArchitectureStatus('creating');
    setArchitectureError('');
    try {
      const response = await window.dock.architecture.createProject({
        workspaceId,
        projectName: architectureProjectName,
        purpose: architecturePurpose,
        techStack: architectureTechStack,
      });
      if (response.ok === false) {
        setArchitectureError(
          response.error.code === 'ARCHITECTURE_CONFLICT'
            ? '생성 대상 문서가 이미 있습니다. 기존 문서는 덮어쓰지 않습니다.'
            : response.error.code === 'WORKSPACE_NOT_SELECTED'
              ? '먼저 문서 폴더를 선택해 주세요.'
              : '프로젝트 문서 세트를 생성하지 못했습니다.',
        );
        setArchitectureStatus('error');
        return;
      }
      if (!(await refreshFiles(workspaceId))) {
        setArchitectureError('생성된 문서 목록을 갱신하지 못했습니다.');
        setArchitectureStatus('error');
        return;
      }
      await openDocument('docs/architecture/arc42.md');
      resetArchitectureDraft();
      closeCommandPalette();
    } catch {
      setArchitectureError('프로젝트 문서 세트를 생성하지 못했습니다.');
      setArchitectureStatus('error');
    }
  };

  const checkArchitectureWorkspace = async () => {
    if (!workspaceId) {
      setArchitectureError('먼저 문서 폴더를 선택해 주세요.');
      setArchitectureCheckStatus('error');
      return;
    }
    setArchitectureCheckStatus('checking');
    setArchitectureError('');
    try {
      const response = await window.dock.architecture.checkProject({
        workspaceId,
      });
      if (response.ok === false) {
        setArchitectureError('아키텍처 문서 정합성을 점검하지 못했습니다.');
        setArchitectureCheckStatus('error');
        return;
      }
      setArchitectureCheckPassed(response.value.passed);
      setArchitectureCheckFiles(response.value.files);
      setArchitectureCheckStatus('complete');
    } catch {
      setArchitectureError('아키텍처 문서 정합성을 점검하지 못했습니다.');
      setArchitectureCheckStatus('error');
    }
  };

  const createAdr = async () => {
    if (!workspaceId) {
      setAdrError('먼저 문서 폴더를 선택해 주세요.');
      setAdrCreateStatus('error');
      return;
    }
    setAdrCreateStatus('creating');
    setAdrError('');
    try {
      const response = await window.dock.architecture.createAdr({
        workspaceId,
        title: adrTitle,
        status: adrStatus,
        context: adrContext,
        decision: adrDecision,
        consequences: adrConsequences,
      });
      if (response.ok === false) {
        setAdrError(
          response.error.code === 'ARCHITECTURE_CONFLICT'
            ? '같은 ADR 파일이 이미 있습니다. 기존 ADR은 덮어쓰지 않습니다.'
            : response.error.code === 'WORKSPACE_NOT_SELECTED'
              ? '먼저 문서 폴더를 선택해 주세요.'
              : 'ADR을 생성하지 못했습니다.',
        );
        setAdrCreateStatus('error');
        return;
      }
      if (!(await refreshFiles(workspaceId))) {
        setAdrError('ADR은 생성했지만 문서 목록을 갱신하지 못했습니다.');
        setAdrCreateStatus('error');
        return;
      }
      await openDocument(response.value.relativePath);
      resetAdrDraft();
      closeCommandPalette();
    } catch {
      setAdrError('ADR을 생성하지 못했습니다.');
      setAdrCreateStatus('error');
    }
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
        recordRuntimeEvent('research-opened', { outcome: 'failure' });
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
      recordRuntimeEvent('research-opened', {
        count: response.value.results.length,
        outcome: 'success',
      });
      closeCommandPalette();
    } catch {
      if (!wasResearchOpen) setResearchOpen(false);
      setLinkError('Research View를 열지 못했습니다. 다시 시도해 주세요.');
      setLinkStatus('error');
      recordRuntimeEvent('research-opened', { outcome: 'failure' });
    }
  };

  const insertResearchLink = (result: LinkInsertTarget) => {
    try {
      const selection = editorSelectionRef.current;
      const editorScrollTop = editorRef.current?.scrollTop;
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
      restoreEditorPosition({ start: cursor, end: cursor }, editorScrollTop);
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
    recordRuntimeEvent('research-closed', { outcome: 'success' });
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
    setImageStatus('searching');
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
          recordRuntimeEvent('image-search', { outcome: 'failure' });
          return;
        }
        results = response.value.results;
      }
      setImageResults(results);
      setImageStatus(results.length > 0 ? 'results' : 'empty');
      recordRuntimeEvent('image-search', {
        count: results.length,
        outcome: 'success',
      });
    } catch {
      setImageResults([]);
      setImageError('이미지 검색에 실패했습니다. 다시 시도해 주세요.');
      setImageStatus('error');
      recordRuntimeEvent('image-search', { outcome: 'failure' });
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
    setImageStatus('downloading');
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
      const insertionContext = imageInsertionContextRef.current;
      if (
        !insertionContext ||
        insertionContext.workspaceId !== workspaceId ||
        insertionContext.selectedPath !== selectedPath
      ) {
        try {
          await window.dock.image.delete({
            workspaceId,
            assetPath: response.value.assetPath,
          });
        } catch {
          // Keep the user-facing insertion error even if cleanup also fails.
        }
        setImageErrorCode('DOCUMENT_CHANGED');
        setImageError(
          '이미지는 저장했지만 원래 문서가 바뀌어 Markdown을 삽입하지 못했습니다. 이미지를 다시 선택해 주세요.',
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
      const selection = insertionContext.selection;
      const editorScrollTop = editorRef.current?.scrollTop;
      const nextContent = insertMarkdownImage(
        content,
        altText,
        response.value.assetPath,
        selection.start,
        selection.end,
        selectedPath,
      );
      setContent(nextContent);
      setAssetRefreshKey((current) => current + 1);
      recordRuntimeEvent('image-inserted', {
        bytes: response.value.bytesWritten,
        outcome: 'success',
      });
      closeCommandPalette();
      const cursor = selection.start + markdown.length;
      editorSelectionRef.current = { start: cursor, end: cursor };
      restoreEditorPosition({ start: cursor, end: cursor }, editorScrollTop);
    } catch {
      setImageErrorCode('INTERNAL');
      setImageError('이미지를 다운로드하거나 저장하지 못했습니다.');
      setImageStatus('error');
      recordRuntimeEvent('image-inserted', { outcome: 'failure' });
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
      const editorScrollTop = editorRef.current?.scrollTop;
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
      setAssetRefreshKey((current) => current + 1);
      recordRuntimeEvent('image-inserted', {
        bytes: response.value.bytesWritten,
        outcome: 'success',
      });
      const cursor = selection.start + markdown.length;
      editorSelectionRef.current = { start: cursor, end: cursor };
      restoreEditorPosition({ start: cursor, end: cursor }, editorScrollTop);
    } catch {
      setSaveError('클립보드 이미지를 저장하지 못했습니다.');
      recordRuntimeEvent('image-inserted', { outcome: 'failure' });
    }
  };

  const insertExistingAsset = (asset: ImageAssetItem) => {
    const altText = asset.displayName.replace(/\.[^.]+$/, '');
    const selection = editorSelectionRef.current;
    const editorScrollTop = editorRef.current?.scrollTop;
    const nextContent = insertMarkdownImage(
      content,
      altText,
      asset.assetPath,
      selection.start,
      selection.end,
      selectedPath,
    );
    const markdown = formatMarkdownImage(
      altText,
      asset.assetPath,
      selectedPath,
    );
    setContent(nextContent);
    recordRuntimeEvent('image-inserted', { outcome: 'success' });
    const cursor = selection.start + markdown.length;
    editorSelectionRef.current = { start: cursor, end: cursor };
    restoreEditorPosition({ start: cursor, end: cursor }, editorScrollTop);
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
            onClick={() => openCommandPalette()}
          >
            명령 팔레트 열기
          </button>
        </div>
      </header>

      {workspaceMoveError && (
        <div className="workspace-operation-toast" role="alert">
          <span>{workspaceMoveError}</span>
          <button
            type="button"
            aria-label="파일 이동 오류 닫기"
            onClick={() => setWorkspaceMoveError('')}
          >
            닫기
          </button>
        </div>
      )}

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
                    setImageStatus('idle');
                    setImageQuery('');
                  }}
                >
                  <strong>/image</strong>
                  <span>이미지 검색 및 삽입</span>
                </button>
                <button
                  className="command-item"
                  type="button"
                  onClick={() => {
                    setActiveCommand('architecture');
                    setArchitectureStatus('idle');
                    setArchitectureError('');
                  }}
                >
                  <strong>프로젝트 설계 문서</strong>
                  <span>
                    Architecture Workspace · 프로젝트 구조와 기술 결정 문서
                    초기화
                  </span>
                </button>
                <button
                  className="command-item"
                  type="button"
                  onClick={() => {
                    setActiveCommand('adr');
                    setAdrCreateStatus('idle');
                    setAdrError('');
                  }}
                >
                  <strong>ADR 작성</strong>
                  <span>
                    새 Architecture Decision Record 작성 및 index 갱신
                  </span>
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
            ) : activeCommand === 'image' ? (
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
                    disabled={
                      imageStatus === 'searching' ||
                      imageStatus === 'downloading'
                    }
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
            ) : activeCommand === 'architecture' ? (
              <form
                className="link-search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void createArchitectureWorkspace();
                }}
              >
                <p className="dialog-message architecture-intro">
                  프로젝트의 구조와 기술 결정을 Markdown 문서로 정리하는
                  기능입니다. 전문 용어를 몰라도 기본 문서를 만든 뒤 내용을 채워
                  갈 수 있습니다.
                </p>
                <div className="command-workspace-picker">
                  <div className="command-workspace-picker__details">
                    <span>문서 저장 위치</span>
                    <strong>
                      {workspaceName ?? '선택된 폴더가 없습니다.'}
                    </strong>
                    <small>
                      {workspaceName
                        ? '이 폴더 안에 프로젝트 문서가 생성됩니다.'
                        : '문서를 생성할 폴더를 먼저 선택해 주세요.'}
                    </small>
                  </div>
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() => void chooseWorkspace()}
                  >
                    {workspaceName ? '폴더 변경' : '폴더 선택'}
                  </button>
                </div>
                <label htmlFor="architecture-project-name">프로젝트 이름</label>
                <input
                  id="architecture-project-name"
                  className="workspace-create__input"
                  value={architectureProjectName}
                  onChange={(event) =>
                    setArchitectureProjectName(event.target.value)
                  }
                  placeholder="예: Dock"
                  autoFocus
                />
                <p className="form-help">
                  문서에 기록할 프로젝트의 이름입니다.
                </p>
                <label htmlFor="architecture-purpose">
                  무엇을 만들고 있나요?
                </label>
                <textarea
                  id="architecture-purpose"
                  className="workspace-create__input architecture-purpose"
                  value={architecturePurpose}
                  onChange={(event) =>
                    setArchitecturePurpose(event.target.value)
                  }
                  placeholder="예: 팀의 기술 문서를 로컬에서 작성하고 관리합니다."
                  rows={3}
                />
                <p className="form-help">
                  프로젝트가 해결하려는 문제와 목표를 적어 주세요.
                </p>
                <label htmlFor="architecture-tech-stack">
                  사용 기술 <span className="label-optional">선택</span>
                </label>
                <input
                  id="architecture-tech-stack"
                  className="workspace-create__input"
                  value={architectureTechStack}
                  onChange={(event) =>
                    setArchitectureTechStack(event.target.value)
                  }
                  placeholder="예: Electron, React, TypeScript"
                />
                <p className="form-help">
                  사용하는 언어, 프레임워크, 데이터베이스 등을 적어 주세요.
                </p>
                <div className="architecture-file-preview">
                  <strong>만들어지는 문서</strong>
                  <p>프로젝트 폴더 안에 다음 초안이 생성됩니다.</p>
                  <div>
                    <b>전체 아키텍처</b>
                    <span>프로젝트의 목표와 전체 구조</span>
                    <code>docs/architecture/arc42.md</code>
                  </div>
                  <div>
                    <b>시스템과 외부 관계</b>
                    <span>사용자·외부 서비스와의 연결</span>
                    <code>docs/architecture/c4-context.md</code>
                  </div>
                  <div>
                    <b>주요 애플리케이션 구성</b>
                    <span>시스템을 구성하는 큰 단위</span>
                    <code>docs/architecture/c4-container.md</code>
                  </div>
                  <div>
                    <b>구성 내부의 책임</b>
                    <span>각 단위가 맡은 역할</span>
                    <code>docs/architecture/c4-component.md</code>
                  </div>
                  <div>
                    <b>기술 결정 목록</b>
                    <span>왜 이렇게 만들었는지 기록하는 문서</span>
                    <code>docs/adr/README.md</code>
                  </div>
                  <div>
                    <b>첫 번째 기술 결정</b>
                    <span>프로젝트 문서 세트를 만든 이유</span>
                    <code>docs/adr/0001-initial-architecture.md</code>
                  </div>
                </div>
                <div className="link-search-form__row">
                  <button
                    className="button button--primary"
                    type="submit"
                    disabled={architectureStatus === 'creating'}
                  >
                    문서 세트 생성
                  </button>
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={closeCommandPalette}
                  >
                    취소
                  </button>
                </div>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => void checkArchitectureWorkspace()}
                  disabled={architectureCheckStatus === 'checking'}
                >
                  문서 정합성 점검
                </button>
              </form>
            ) : (
              <form
                className="link-search-form adr-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void createAdr();
                }}
              >
                <p className="dialog-message">
                  다음 ADR 번호를 자동으로 부여하고 docs/adr/README.md index를
                  갱신합니다.
                </p>
                <div className="command-workspace-picker">
                  <div className="command-workspace-picker__details">
                    <span>문서 저장 위치</span>
                    <strong>
                      {workspaceName ?? '선택된 폴더가 없습니다.'}
                    </strong>
                    <small>
                      {workspaceName
                        ? '이 폴더 안에 ADR 문서가 생성됩니다.'
                        : '문서를 생성할 폴더를 먼저 선택해 주세요.'}
                    </small>
                  </div>
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() => void chooseWorkspace()}
                  >
                    {workspaceName ? '폴더 변경' : '폴더 선택'}
                  </button>
                </div>
                <label htmlFor="adr-title">결정 제목</label>
                <input
                  id="adr-title"
                  className="workspace-create__input"
                  value={adrTitle}
                  onChange={(event) => setAdrTitle(event.target.value)}
                  placeholder="예: ADR 작성 흐름을 애플리케이션에 추가"
                  autoFocus
                  required
                />
                <label htmlFor="adr-status">상태</label>
                <select
                  id="adr-status"
                  className="workspace-create__input"
                  value={adrStatus}
                  onChange={(event) =>
                    setAdrStatus(
                      event.target.value as
                        | 'Proposed'
                        | 'Accepted'
                        | 'Rejected'
                        | 'Superseded',
                    )
                  }
                >
                  <option value="Proposed">Proposed</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Superseded">Superseded</option>
                </select>
                <label htmlFor="adr-context">배경</label>
                <textarea
                  id="adr-context"
                  className="workspace-create__input adr-textarea"
                  value={adrContext}
                  onChange={(event) => setAdrContext(event.target.value)}
                  placeholder="어떤 문제나 요구사항이 이 결정을 만들었는지 적어 주세요."
                  rows={4}
                  required
                />
                <label htmlFor="adr-decision">결정</label>
                <textarea
                  id="adr-decision"
                  className="workspace-create__input adr-textarea"
                  value={adrDecision}
                  onChange={(event) => setAdrDecision(event.target.value)}
                  placeholder="무엇을 선택했는지 적어 주세요."
                  rows={4}
                  required
                />
                <label htmlFor="adr-consequences">결과</label>
                <textarea
                  id="adr-consequences"
                  className="workspace-create__input adr-textarea"
                  value={adrConsequences}
                  onChange={(event) => setAdrConsequences(event.target.value)}
                  placeholder="기대 효과와 트레이드오프를 적어 주세요."
                  rows={4}
                  required
                />
                <div className="link-search-form__row">
                  <button
                    className="button button--primary"
                    type="submit"
                    disabled={adrCreateStatus === 'creating'}
                  >
                    ADR 생성
                  </button>
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={closeCommandPalette}
                  >
                    취소
                  </button>
                </div>
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
            {activeCommand === 'image' && imageStatus === 'searching' && (
              <p className="dialog-message" role="status">
                이미지를 검색하고 있습니다.
              </p>
            )}
            {activeCommand === 'image' && imageStatus === 'downloading' && (
              <p className="dialog-message" role="status">
                이미지를 다운로드하고 문서에 삽입하고 있습니다.
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
            {activeCommand === 'architecture' &&
              architectureStatus === 'creating' && (
                <p className="dialog-message" role="status">
                  프로젝트 문서 세트를 생성하고 있습니다.
                </p>
              )}
            {activeCommand === 'architecture' &&
              architectureStatus === 'error' && (
                <p
                  className="dialog-message dialog-message--error"
                  role="alert"
                >
                  {architectureError}
                </p>
              )}
            {activeCommand === 'architecture' &&
              architectureCheckStatus === 'checking' && (
                <p className="dialog-message" role="status">
                  아키텍처 문서 정합성을 점검하고 있습니다.
                </p>
              )}
            {activeCommand === 'architecture' &&
              architectureCheckStatus === 'complete' && (
                <div className="architecture-check" role="status">
                  <strong>
                    {architectureCheckPassed
                      ? '문서 세트가 정상입니다.'
                      : '보완이 필요한 문서가 있습니다.'}
                  </strong>
                  <ul aria-label="아키텍처 문서 점검 결과">
                    {architectureCheckFiles.map((file) => (
                      <li key={file.relativePath}>
                        <code>{file.relativePath}</code>
                        <span>
                          {file.status === 'present'
                            ? '정상'
                            : file.status === 'missing'
                              ? '없음'
                              : '확인 필요'}
                        </span>
                        {file.issues.length > 0 && (
                          <small>{file.issues.join(' ')}</small>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            {activeCommand === 'adr' && adrCreateStatus === 'creating' && (
              <p className="dialog-message" role="status">
                ADR을 생성하고 index를 갱신하고 있습니다.
              </p>
            )}
            {activeCommand === 'adr' && adrCreateStatus === 'error' && (
              <p className="dialog-message dialog-message--error" role="alert">
                {adrError}
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

      <div className="workspace-shell">
        <nav className="activity-bar" aria-label="작업 영역">
          <button
            className="activity-bar__button"
            type="button"
            aria-controls={explorerOpen ? 'workspace-sidebar' : undefined}
            aria-expanded={explorerOpen}
            aria-label={explorerOpen ? '탐색기' : '탐색기 열기'}
            title={explorerOpen ? '탐색기 접기' : '탐색기 열기'}
            onClick={() =>
              setWorkspacePanel((panel) =>
                panel === 'explorer' ? undefined : 'explorer',
              )
            }
          >
            <ExplorerIcon />
            <span className="visually-hidden">
              {explorerOpen ? '탐색기 접기' : '탐색기 열기'}
            </span>
          </button>
          <button
            className="activity-bar__button"
            type="button"
            aria-controls={workspacePanel ? 'workspace-sidebar' : undefined}
            aria-expanded={workspacePanel === 'search'}
            aria-label={workspacePanel === 'search' ? '검색 닫기' : '검색 열기'}
            title={workspacePanel === 'search' ? '검색 닫기' : '검색 열기'}
            onClick={() =>
              setWorkspacePanel((panel) =>
                panel === 'search' ? undefined : 'search',
              )
            }
          >
            <SearchIcon />
            <span className="visually-hidden">
              {workspacePanel === 'search' ? '검색 닫기' : '검색 열기'}
            </span>
          </button>
          <button
            className="activity-bar__button"
            type="button"
            aria-controls={workspacePanel ? 'workspace-sidebar' : undefined}
            aria-expanded={workspacePanel === 'backlinks'}
            aria-label={
              workspacePanel === 'backlinks'
                ? '연결 문서 닫기'
                : '연결 문서 열기'
            }
            title={
              workspacePanel === 'backlinks'
                ? '연결 문서 닫기'
                : '연결 문서 열기'
            }
            onClick={() =>
              setWorkspacePanel((panel) =>
                panel === 'backlinks' ? undefined : 'backlinks',
              )
            }
          >
            <BacklinksIcon />
            <span className="visually-hidden">
              {workspacePanel === 'backlinks'
                ? '연결 문서 닫기'
                : '연결 문서 열기'}
            </span>
          </button>
          <button
            className="activity-bar__button"
            type="button"
            aria-controls={workspacePanel ? 'workspace-sidebar' : undefined}
            aria-expanded={workspacePanel === 'outline'}
            aria-label={
              workspacePanel === 'outline' ? '문서 개요 닫기' : '문서 개요 열기'
            }
            title={
              workspacePanel === 'outline' ? '문서 개요 닫기' : '문서 개요 열기'
            }
            onClick={() =>
              setWorkspacePanel((panel) =>
                panel === 'outline' ? undefined : 'outline',
              )
            }
          >
            <OutlineIcon />
            <span className="visually-hidden">
              {workspacePanel === 'outline'
                ? '문서 개요 닫기'
                : '문서 개요 열기'}
            </span>
          </button>
          <button
            className="activity-bar__button"
            type="button"
            aria-controls={workspacePanel ? 'workspace-sidebar' : undefined}
            aria-expanded={workspacePanel === 'assets'}
            aria-label={
              workspacePanel === 'assets'
                ? '이미지 자산 닫기'
                : '이미지 자산 열기'
            }
            title={
              workspacePanel === 'assets'
                ? '이미지 자산 닫기'
                : '이미지 자산 열기'
            }
            onClick={() =>
              setWorkspacePanel((panel) =>
                panel === 'assets' ? undefined : 'assets',
              )
            }
          >
            <AssetsIcon />
            <span className="visually-hidden">
              {workspacePanel === 'assets'
                ? '이미지 자산 닫기'
                : '이미지 자산 열기'}
            </span>
          </button>
          <button
            className="activity-bar__button"
            type="button"
            aria-controls={workspacePanel ? 'workspace-sidebar' : undefined}
            aria-expanded={workspacePanel === 'architecture'}
            aria-label={
              workspacePanel === 'architecture'
                ? '프로젝트 설계 문서 닫기'
                : '프로젝트 설계 문서 열기'
            }
            title={
              workspacePanel === 'architecture'
                ? '프로젝트 설계 문서 닫기'
                : '프로젝트 설계 문서 열기'
            }
            onClick={() =>
              setWorkspacePanel((panel) =>
                panel === 'architecture' ? undefined : 'architecture',
              )
            }
          >
            <ArchitectureIcon />
            <span className="visually-hidden">
              {workspacePanel === 'architecture'
                ? '프로젝트 설계 문서 닫기'
                : '프로젝트 설계 문서 열기'}
            </span>
          </button>
          <button
            className="activity-bar__button"
            type="button"
            aria-controls={workspacePanel ? 'workspace-sidebar' : undefined}
            aria-expanded={workspacePanel === 'diagnostics'}
            aria-label={
              workspacePanel === 'diagnostics'
                ? '문서 검사 닫기'
                : '문서 검사 열기'
            }
            title={
              workspacePanel === 'diagnostics'
                ? '문서 검사 닫기'
                : '문서 검사 열기'
            }
            onClick={() =>
              setWorkspacePanel((panel) =>
                panel === 'diagnostics' ? undefined : 'diagnostics',
              )
            }
          >
            <DiagnosticsIcon />
            <span className="visually-hidden">
              {workspacePanel === 'diagnostics'
                ? '문서 검사 닫기'
                : '문서 검사 열기'}
            </span>
          </button>
        </nav>

        <div
          className={`workspace-layout${
            workspacePanel ? '' : ' workspace-layout--explorer-collapsed'
          }`}
        >
          {workspacePanel && (
            <aside
              id="workspace-sidebar"
              className={`workspace-sidebar workspace-sidebar--${workspacePanel}`}
              aria-labelledby="workspace-title"
            >
              {workspacePanel === 'explorer' ? (
                <>
                  <div className="panel-heading">
                    <div>
                      <p className="panel-heading__eyebrow">
                        DOCUMENT WORKSPACE
                      </p>
                      <h2 id="workspace-title">문서</h2>
                    </div>
                    <div className="panel-heading__actions">
                      <button
                        className="button button--quiet"
                        type="button"
                        onClick={() =>
                          setAssetRefreshKey((current) => current + 1)
                        }
                        disabled={!workspaceId || assetStatus === 'loading'}
                      >
                        새로고침
                      </button>
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
                      <button
                        className="button button--quiet workspace-sidebar__collapse"
                        type="button"
                        aria-label="탐색기 패널 접기"
                        onClick={() => setWorkspacePanel(undefined)}
                      >
                        접기
                      </button>
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
                        <p className="workspace-name">
                          현재 폴더: {workspaceName}
                        </p>
                        <form
                          className="workspace-create"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void createDocument();
                          }}
                        >
                          <label htmlFor="new-document-path">
                            새 문서 경로
                          </label>
                          <input
                            id="new-document-path"
                            className="workspace-create__input"
                            value={newDocumentPath}
                            onChange={(event) =>
                              setNewDocumentPath(event.target.value)
                            }
                            placeholder="notes/today.md"
                          />
                          <label htmlFor="new-document-template">
                            문서 템플릿
                          </label>
                          <select
                            id="new-document-template"
                            className="workspace-create__input"
                            value={newDocumentTemplate}
                            onChange={(event) =>
                              setNewDocumentTemplate(
                                event.target.value as DocumentTemplateId,
                              )
                            }
                          >
                            {DOCUMENT_TEMPLATES.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.label}
                              </option>
                            ))}
                          </select>
                          <button
                            className="button button--quiet"
                            type="submit"
                          >
                            새 문서 생성
                          </button>
                        </form>
                      </>
                    )}
                    {workspaceName ? (
                      <WorkspaceExplorer
                        entries={workspaceEntries}
                        selectedPath={selectedPath}
                        onOpen={(relativePath) =>
                          void openDocument(relativePath)
                        }
                        onCreate={createWorkspaceEntry}
                        onRename={renameWorkspaceEntry}
                        onDelete={deleteWorkspaceEntry}
                        onMove={moveWorkspaceEntry}
                        createError={workspaceFolderError}
                      />
                    ) : (
                      <WorkspaceState state={state} />
                    )}
                  </div>
                </>
              ) : workspacePanel === 'search' ? (
                <>
                  <div className="panel-heading">
                    <div>
                      <p className="panel-heading__eyebrow">WORKSPACE SEARCH</p>
                      <h2 id="workspace-title">검색</h2>
                    </div>
                    <button
                      className="button button--quiet"
                      type="button"
                      aria-label="검색 닫기"
                      onClick={() => setWorkspacePanel(undefined)}
                    >
                      닫기
                    </button>
                  </div>
                  <div className="workspace-sidebar__body workspace-search-panel">
                    <label htmlFor="workspace-search-query">
                      문서 검색 또는 빠른 열기
                    </label>
                    <input
                      id="workspace-search-query"
                      className="workspace-create__input"
                      value={workspaceSearchQuery}
                      onChange={(event) =>
                        setWorkspaceSearchQuery(event.target.value)
                      }
                      placeholder="파일명 또는 문서 내용 검색"
                      autoFocus
                    />
                    {!workspaceId ? (
                      <EmptyStateChip
                        title="선택된 폴더가 없습니다."
                        description="문서 폴더를 선택하면 파일과 문서 내용을 검색할 수 있습니다."
                      />
                    ) : !workspaceSearchQuery.trim() ? (
                      quickOpenFiles.length > 0 ? (
                        <ul
                          className="file-list"
                          aria-label="빠른 열기 파일 목록"
                        >
                          {quickOpenFiles.map((file) => (
                            <li key={file.relativePath}>
                              <button
                                className="file-list__item"
                                type="button"
                                onClick={() =>
                                  void openDocument(file.relativePath)
                                }
                              >
                                {file.relativePath}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <WorkspaceState state={state} />
                      )
                    ) : workspaceSearchStatus === 'loading' ? (
                      <p className="workspace-state" role="status">
                        문서를 검색하고 있습니다.
                      </p>
                    ) : workspaceSearchResults.length > 0 ? (
                      <ul
                        className="workspace-search-results"
                        aria-label="문서 검색 결과"
                      >
                        {workspaceSearchResults.map((result) => (
                          <li key={`${result.relativePath}:${result.line}`}>
                            <button
                              className="workspace-search-result"
                              type="button"
                              onClick={() => {
                                void openDocument(result.relativePath).then(
                                  () => {
                                    window.setTimeout(
                                      () => moveEditorToLine(result.line),
                                      0,
                                    );
                                  },
                                );
                              }}
                            >
                              <strong>{result.relativePath}</strong>
                              <span>
                                {result.line}행 · {result.snippet}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="workspace-state" role="status">
                        일치하는 문서가 없습니다.
                      </p>
                    )}
                  </div>
                </>
              ) : workspacePanel === 'backlinks' ? (
                <>
                  <div className="panel-heading">
                    <div>
                      <p className="panel-heading__eyebrow">BACKLINKS</p>
                      <h2 id="workspace-title">연결 문서</h2>
                    </div>
                    <button
                      className="button button--quiet"
                      type="button"
                      aria-label="연결 문서 닫기"
                      onClick={() => setWorkspacePanel(undefined)}
                    >
                      닫기
                    </button>
                  </div>
                  <div className="workspace-sidebar__body backlinks-panel">
                    <p className="backlinks-panel__description">
                      현재 문서를 가리키는 로컬 Markdown 링크를 보여줍니다.
                    </p>
                    {!workspaceId || !selectedPath ? (
                      <EmptyStateChip
                        title="문서가 선택되지 않았습니다."
                        description="문서를 열면 해당 문서를 참조하는 연결 문서가 표시됩니다."
                      />
                    ) : backlinkStatus === 'loading' ? (
                      <p className="workspace-state" role="status">
                        연결 문서를 찾고 있습니다.
                      </p>
                    ) : (
                      <>
                        <section className="backlinks-section">
                          <h3>이 문서가 연결한 문서</h3>
                          {documentLinks.length > 0 ? (
                            <ul
                              className="backlinks-list"
                              aria-label="현재 문서의 연결 목록"
                            >
                              {documentLinks.map((result) => (
                                <li key={`${result.targetPath}:${result.line}`}>
                                  <button
                                    className="backlink-item"
                                    type="button"
                                    onClick={() =>
                                      void openDocument(result.targetPath)
                                    }
                                  >
                                    <strong>{result.targetPath}</strong>
                                    <span>
                                      {result.line}행 · {result.snippet}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="backlinks-section__empty">
                              연결한 문서가 없습니다.
                            </p>
                          )}
                        </section>
                        <section className="backlinks-section">
                          <h3>이 문서를 참조하는 문서</h3>
                          {backlinkResults.length > 0 ? (
                            <ul
                              className="backlinks-list"
                              aria-label="현재 문서를 참조하는 목록"
                            >
                              {backlinkResults.map((result) => (
                                <li
                                  key={`${result.relativePath}:${result.line}`}
                                >
                                  <button
                                    className="backlink-item"
                                    type="button"
                                    onClick={() => {
                                      void openDocument(
                                        result.relativePath,
                                      ).then(() => {
                                        window.setTimeout(
                                          () => moveEditorToLine(result.line),
                                          0,
                                        );
                                      });
                                    }}
                                  >
                                    <strong>{result.relativePath}</strong>
                                    <span>
                                      {result.line}행 · {result.snippet}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="backlinks-section__empty">
                              참조하는 문서가 없습니다.
                            </p>
                          )}
                        </section>
                      </>
                    )}
                  </div>
                </>
              ) : workspacePanel === 'outline' ? (
                <>
                  <div className="panel-heading">
                    <div>
                      <p className="panel-heading__eyebrow">DOCUMENT OUTLINE</p>
                      <h2 id="workspace-title">문서 개요</h2>
                    </div>
                    <button
                      className="button button--quiet"
                      type="button"
                      aria-label="문서 개요 닫기"
                      onClick={() => setWorkspacePanel(undefined)}
                    >
                      닫기
                    </button>
                  </div>
                  <div className="workspace-sidebar__body">
                    {outlineItems.length > 0 ? (
                      <ul className="outline-list" aria-label="문서 제목 목록">
                        {outlineItems.map((item) => (
                          <li key={`${item.line}-${item.text}`}>
                            <button
                              className="outline-list__item"
                              type="button"
                              style={{
                                paddingInlineStart: `${0.65 + (item.level - 1) * 0.75}rem`,
                              }}
                              onClick={() => moveEditorToOutlineItem(item)}
                            >
                              <span>{item.text}</span>
                              <small>#{item.line + 1}</small>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyStateChip
                        title="문서 개요가 없습니다."
                        description="Markdown 제목을 작성하면 이곳에 표시됩니다."
                      />
                    )}
                  </div>
                </>
              ) : workspacePanel === 'assets' ? (
                <>
                  <div className="panel-heading">
                    <div>
                      <p className="panel-heading__eyebrow">IMAGE ASSETS</p>
                      <h2 id="workspace-title">이미지 자산</h2>
                    </div>
                    <div className="panel-heading__actions">
                      <button
                        className="button button--quiet"
                        type="button"
                        onClick={() => void openWorkspaceFolder('assets')}
                        disabled={!workspaceId}
                      >
                        폴더 열기
                      </button>
                      <button
                        className="button button--quiet"
                        type="button"
                        aria-label="이미지 자산 닫기"
                        onClick={() => setWorkspacePanel(undefined)}
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                  <div className="workspace-sidebar__body">
                    {assetStatus === 'loading' ? (
                      <p className="workspace-state" role="status">
                        이미지 자산을 불러오고 있습니다.
                      </p>
                    ) : assetStatus === 'error' ? (
                      <p
                        className="workspace-state workspace-state--error"
                        role="alert"
                      >
                        이미지 자산을 불러오지 못했습니다.
                      </p>
                    ) : assets.length > 0 ? (
                      <ul className="asset-list" aria-label="이미지 자산 목록">
                        {assets.map((asset) => (
                          <li key={asset.assetPath}>
                            <button
                              className="asset-list__item"
                              type="button"
                              onClick={() => insertExistingAsset(asset)}
                              title={`${asset.assetPath} 삽입`}
                            >
                              {assetSources[asset.assetPath] ? (
                                <img
                                  src={assetSources[asset.assetPath]}
                                  alt=""
                                  className="asset-list__thumbnail"
                                />
                              ) : (
                                <span className="asset-list__placeholder">
                                  이미지
                                </span>
                              )}
                              <span className="asset-list__details">
                                <strong>{asset.displayName}</strong>
                                <small>{asset.assetPath}</small>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyStateChip
                        title="이미지 자산이 없습니다."
                        description="assets 폴더에 PNG, JPEG, WebP 파일을 추가하면 여기에 표시됩니다."
                      />
                    )}
                  </div>
                </>
              ) : workspacePanel === 'diagnostics' ? (
                <>
                  <div className="panel-heading">
                    <div>
                      <p className="panel-heading__eyebrow">DOCUMENT CHECK</p>
                      <h2 id="workspace-title">문서 검사</h2>
                    </div>
                    <div className="panel-heading__actions">
                      <button
                        className="button button--quiet"
                        type="button"
                        onClick={() =>
                          setAssetRefreshKey((current) => current + 1)
                        }
                        disabled={diagnosticsStatus === 'loading'}
                      >
                        새로고침
                      </button>
                      <button
                        className="button button--quiet"
                        type="button"
                        aria-label="문서 검사 닫기"
                        onClick={() => setWorkspacePanel(undefined)}
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                  <div className="workspace-sidebar__body diagnostics-panel">
                    <p className="diagnostics-panel__description">
                      현재 문서의 링크·이미지·제목·Mermaid 상태를 확인합니다.
                    </p>
                    {!workspaceId || !selectedPath ? (
                      <EmptyStateChip
                        title="검사할 문서가 없습니다."
                        description="문서 폴더와 Markdown 문서를 선택하면 검사 결과가 표시됩니다."
                      />
                    ) : diagnosticsStatus === 'loading' ? (
                      <p className="workspace-state" role="status">
                        문서 검사에 필요한 이미지 목록을 불러오고 있습니다.
                      </p>
                    ) : diagnosticsStatus === 'error' ? (
                      <p
                        className="workspace-state workspace-state--error"
                        role="alert"
                      >
                        이미지 목록을 불러오지 못해 일부 검사 결과가 제한됩니다.
                      </p>
                    ) : documentDiagnostics.length === 0 ? (
                      <EmptyStateChip
                        title="문제 없음"
                        description="현재 문서에서 확인할 문제를 찾지 못했습니다."
                      />
                    ) : (
                      <ul
                        className="diagnostics-list"
                        aria-label="문서 검사 결과"
                      >
                        {documentDiagnostics.map((diagnostic, index) => (
                          <li
                            className={`diagnostics-list__item diagnostics-list__item--${diagnostic.severity}`}
                            key={`${diagnostic.code}-${diagnostic.line ?? 'document'}-${index}`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                diagnostic.line &&
                                moveEditorToLine(diagnostic.line)
                              }
                              disabled={!diagnostic.line}
                            >
                              <span>
                                {diagnostic.severity === 'error'
                                  ? '오류'
                                  : diagnostic.severity === 'warning'
                                    ? '경고'
                                    : '정보'}
                              </span>
                              <strong>{diagnostic.message}</strong>
                              {diagnostic.line && (
                                <small>{diagnostic.line}행으로 이동</small>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="panel-heading">
                    <div>
                      <p className="panel-heading__eyebrow">
                        ARCHITECTURE WORKSPACE
                      </p>
                      <h2 id="workspace-title">프로젝트 설계 문서</h2>
                    </div>
                    <button
                      className="button button--quiet"
                      type="button"
                      aria-label="프로젝트 설계 문서 닫기"
                      onClick={() => setWorkspacePanel(undefined)}
                    >
                      닫기
                    </button>
                  </div>
                  <div className="workspace-sidebar__body architecture-panel">
                    <p className="architecture-panel__description">
                      arc42·C4·ADR 문서를 한곳에서 열고 정합성을 점검합니다.
                    </p>
                    <div className="architecture-panel__actions">
                      <button
                        className="button button--primary"
                        type="button"
                        onClick={openArchitectureInitializer}
                      >
                        문서 세트 초기화
                      </button>
                      <button
                        className="button button--quiet"
                        type="button"
                        onClick={openAdrComposer}
                        disabled={!workspaceId}
                      >
                        ADR 작성
                      </button>
                      <button
                        className="button button--quiet"
                        type="button"
                        onClick={() => void checkArchitectureWorkspace()}
                        disabled={
                          !workspaceId || architectureCheckStatus === 'checking'
                        }
                      >
                        정합성 점검
                      </button>
                    </div>
                    {!workspaceId ? (
                      <EmptyStateChip
                        title="선택된 폴더가 없습니다."
                        description="문서 폴더를 선택하면 프로젝트 설계 문서가 여기에 표시됩니다."
                      />
                    ) : (
                      <ul
                        className="architecture-file-list"
                        aria-label="아키텍처 문서 목록"
                      >
                        {architectureFileItems.map((item) => {
                          const file = files.find(
                            (candidate) => candidate.relativePath === item.path,
                          );
                          return (
                            <li key={item.path}>
                              <button
                                className="architecture-file-list__item"
                                type="button"
                                disabled={!file}
                                onClick={() =>
                                  file && openDocument(file.relativePath)
                                }
                              >
                                <span>{item.label}</span>
                                <small>{item.technical}</small>
                                <code>{item.path}</code>
                                <small>{file ? '열기' : '없음'}</small>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {architectureCheckStatus === 'checking' && (
                      <p className="workspace-state" role="status">
                        아키텍처 문서 정합성을 점검하고 있습니다.
                      </p>
                    )}
                    {architectureCheckStatus === 'complete' && (
                      <div className="architecture-check" role="status">
                        <strong>
                          {architectureCheckPassed
                            ? '문서 세트가 정상입니다.'
                            : '보완이 필요한 문서가 있습니다.'}
                        </strong>
                        <ul aria-label="아키텍처 문서 점검 결과">
                          {architectureCheckFiles.map((file) => (
                            <li key={file.relativePath}>
                              <code>{file.relativePath}</code>
                              <span>
                                {file.status === 'present'
                                  ? '정상'
                                  : file.status === 'missing'
                                    ? '없음'
                                    : '확인 필요'}
                              </span>
                              {file.issues.length > 0 && (
                                <small>{file.issues.join(' ')}</small>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {architectureCheckStatus === 'error' && (
                      <p
                        className="workspace-state workspace-state--error"
                        role="alert"
                      >
                        아키텍처 문서 정합성을 점검하지 못했습니다.
                      </p>
                    )}
                  </div>
                </>
              )}
            </aside>
          )}

          <section className="editor-panel" aria-labelledby="editor-title">
            {openDocumentPaths.length > 0 && (
              <div
                className="document-tabs"
                role="tablist"
                aria-label="열린 문서"
              >
                {openDocumentPaths.map((path) => (
                  <div
                    className={`document-tab${
                      path === selectedPath ? ' document-tab--active' : ''
                    }`}
                    key={path}
                  >
                    <button
                      className="document-tab__select"
                      type="button"
                      role="tab"
                      aria-selected={path === selectedPath}
                      onClick={() => void openDocument(path)}
                    >
                      {path}
                    </button>
                    <button
                      className="document-tab__close"
                      type="button"
                      aria-label={`${path} 닫기`}
                      onClick={() => void closeDocumentTab(path)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="panel-heading">
              <div>
                <p className="panel-heading__eyebrow">EDITOR</p>
                <h2 id="editor-title">{selectedPath ?? '새 문서'}</h2>
              </div>
              <button
                className="button button--quiet"
                type="button"
                onClick={() => void saveDocument()}
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
            {documentError && (
              <p className="editor-save-error" role="alert">
                {documentError}
              </p>
            )}
            {documentConflict && (
              <div className="document-conflict" role="alert">
                <div>
                  <strong>
                    {documentConflict.kind === 'changed'
                      ? '문서가 외부에서 변경되었습니다.'
                      : '문서가 외부에서 삭제되거나 이름이 변경되었습니다.'}
                  </strong>
                  <p>
                    미저장 내용을 유지하거나 외부 변경을 적용할 방법을 선택해
                    주세요.
                  </p>
                </div>
                <div className="document-conflict__actions">
                  {documentConflict.kind === 'changed' && (
                    <button
                      className="button button--quiet"
                      type="button"
                      onClick={reloadExternalDocument}
                    >
                      외부 변경 불러오기
                    </button>
                  )}
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={() => void saveDocument(true)}
                  >
                    내 작업으로 저장
                  </button>
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={closeConflictedDocument}
                  >
                    문서 닫기
                  </button>
                </div>
              </div>
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
              onKeyDown={(event) => {
                if (
                  (event.ctrlKey || event.metaKey) &&
                  event.key.toLowerCase() === 's'
                ) {
                  event.preventDefault();
                  void saveDocument();
                  return;
                }
                const command = editorCommandSuggestion?.command;
                if (command && (event.key === 'Tab' || event.key === 'Enter')) {
                  event.preventDefault();
                  activateEditorCommand(command);
                  return;
                }
                if (event.key === 'Escape') {
                  setEditorCommandSuggestion(undefined);
                }
              }}
              onPaste={handleEditorPaste}
              onChange={(event) => {
                const nextContent = event.target.value;
                setContent(nextContent);
                scheduleEditorInputTelemetry(nextContent.length);
                editorSelectionRef.current = {
                  start: event.target.selectionStart,
                  end: event.target.selectionEnd,
                };
                setEditorCommandSuggestion(
                  event.target.selectionStart === event.target.selectionEnd
                    ? findEditorCommandSuggestion(
                        nextContent,
                        event.target.selectionStart,
                      )
                    : undefined,
                );
                setSaveError('');
              }}
            />
            {editorCommandSuggestion && (
              <div
                className="editor-command-suggestions"
                role="toolbar"
                aria-label="문서 명령 제안"
              >
                <span className="editor-command-suggestions__hint">
                  입력한 명령 실행
                </span>
                <button
                  className="editor-command-suggestion"
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    activateEditorCommand(editorCommandSuggestion.command)
                  }
                >
                  {editorCommandSuggestion.command === 'link'
                    ? '링크 검색'
                    : '이미지 검색'}
                  <kbd>Tab</kbd>
                  <kbd>Enter</kbd>
                </button>
              </div>
            )}
          </section>

          <section className="preview-panel" aria-labelledby="preview-title">
            <div className="panel-heading">
              <div>
                <p className="panel-heading__eyebrow">PREVIEW</p>
                <h2 id="preview-title">미리보기</h2>
              </div>
              <div className="panel-heading__actions">
                <button
                  className="button button--quiet"
                  type="button"
                  aria-pressed={scrollSyncEnabled}
                  onClick={() => setScrollSyncEnabled((enabled) => !enabled)}
                  title="Editor와 Preview의 스크롤 위치를 맞춥니다."
                >
                  {scrollSyncEnabled
                    ? '스크롤 동기화 켜짐'
                    : '스크롤 동기화 꺼짐'}
                </button>
              </div>
            </div>
            {selectedPath ? (
              <div
                ref={previewRef}
                className="preview-content"
                onClick={handlePreviewClick}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <EmptyStateChip
                title="미리볼 문서가 없습니다."
                description="문서를 열면 안전한 Markdown 미리보기가 이 영역에 표시됩니다."
              />
            )}
          </section>
        </div>
      </div>

      <footer className="app-status" aria-label="문서 상태">
        <span>{dirty ? '변경사항 있음' : '준비됨'}</span>
        <span>{workspaceName ?? '폴더를 선택해 문서를 시작하세요.'}</span>
      </footer>
    </main>
  );
};

export default App;
