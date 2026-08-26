import {
  WebContentsView,
  type BrowserWindow,
  type WebContentsViewConstructorOptions,
} from 'electron';
import { isAllowedLinkUrl } from '../shared/link';
import {
  ResearchSearchResultSchema,
  type ResearchTabInfo,
  type ResearchSearchResult,
} from '../shared/ipc';

const GOOGLE_SEARCH_URL = 'https://www.google.com/search';
const RESEARCH_PARTITION = 'dock-research';
const MAIN_HEADER_HEIGHT = 72;
const RESEARCH_TOOLBAR_HEIGHT = 96;
const RESEARCH_WORKBENCH_HEIGHT_RATIO = 0.4;
const MIN_RESEARCH_WORKBENCH_HEIGHT = 352;
const MAX_RESEARCH_WORKBENCH_HEIGHT = 512;
const MAX_LINK_TITLE_LENGTH = 500;
const MAX_LINK_URL_LENGTH = 2048;
const MAX_RESEARCH_RESULTS = 10;
const MAX_RESEARCH_TABS = 6;

const GOOGLE_RESULT_EXTRACTOR = `
(() => Array.from(document.querySelectorAll('h3')).flatMap((heading) => {
  const anchor = heading.closest('a');
  const title = heading?.textContent?.replace(/\\s+/g, ' ').trim();
  const href = anchor?.href;
  return title && href ? [{ title, href }] : [];
}))()
`;
const GOOGLE_RESULT_EXTRACTION_ATTEMPTS = 8;
const GOOGLE_RESULT_EXTRACTION_INTERVAL_MS = 250;

export interface ResearchCurrentLink {
  title: string;
  url: string;
}

export interface ResearchInfo {
  activeTabId: string | null;
  tabs: ResearchTabInfo[];
}

type ResearchResultCandidate = {
  title?: unknown;
  href?: unknown;
};

type ResearchViewFactory = (
  options: WebContentsViewConstructorOptions,
) => WebContentsView;

export const createGoogleSearchUrl = (query: string): string => {
  const url = new URL(GOOGLE_SEARCH_URL);
  url.searchParams.set('q', query);
  return url.toString();
};

export const isAllowedResearchUrl = (url: string): boolean =>
  isAllowedLinkUrl(url);

const unwrapGoogleResultUrl = (href: string): string | undefined => {
  try {
    const url = new URL(href);
    if (url.hostname.endsWith('.google.com') && url.pathname === '/url') {
      return url.searchParams.get('q') ?? undefined;
    }
    return href;
  } catch {
    return undefined;
  }
};

export const normalizeResearchSearchResults = (
  candidates: unknown,
): ResearchSearchResult[] => {
  if (!Array.isArray(candidates)) return [];

  const results: ResearchSearchResult[] = [];
  const seenUrls = new Set<string>();
  for (const candidate of candidates as ResearchResultCandidate[]) {
    if (
      typeof candidate?.title !== 'string' ||
      typeof candidate.href !== 'string'
    ) {
      continue;
    }
    const url = unwrapGoogleResultUrl(candidate.href);
    const title = candidate.title.replace(/\s+/g, ' ').trim();
    if (!url || seenUrls.has(url)) continue;
    const parsed = ResearchSearchResultSchema.safeParse({ title, url });
    if (!parsed.success) continue;
    seenUrls.add(url);
    results.push(parsed.data);
    if (results.length === MAX_RESEARCH_RESULTS) break;
  }
  return results;
};

export const createResearchWebPreferences = () => ({
  partition: RESEARCH_PARTITION,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
});

const createResearchView = (
  options: WebContentsViewConstructorOptions,
): WebContentsView => new WebContentsView(options);

export class ResearchViewManager {
  private readonly tabs = new Map<string, WebContentsView>();
  private activeTabId: string | undefined;
  private nextTabId = 1;

  constructor(
    private readonly mainWindow: BrowserWindow,
    private readonly createView: ResearchViewFactory = createResearchView,
  ) {
    mainWindow.on('resize', () => this.layout());
    mainWindow.once('close', () => this.close());
  }

  async open(query: string): Promise<ResearchSearchResult[]> {
    const tab = this.createTab();
    try {
      await tab.view.webContents.loadURL(createGoogleSearchUrl(query));
    } catch (error) {
      // Google may finish on an allowed anti-bot or consent page while
      // Chromium reports the intermediate navigation as aborted. Keep that
      // page available for explicit user navigation and current-page insert.
      try {
        if (isAllowedResearchUrl(tab.view.webContents.getURL())) {
          this.layout();
          return [];
        }
      } catch {
        // Fall through to the real load failure path.
      }
      this.closeTab(tab.id);
      throw error;
    }
    if (!this.isGoogleSearchPage(tab.view)) {
      this.layout();
      return [];
    }
    const results = await this.extractSearchResults(tab.view);
    this.layout();
    return results;
  }

  close(): void {
    for (const [id] of this.tabs) this.closeTab(id);
  }

  info(): ResearchInfo {
    return {
      activeTabId: this.activeTabId ?? null,
      tabs: [...this.tabs.entries()].map(([id, view]) =>
        this.toTabInfo(id, view),
      ),
    };
  }

  selectTab(tabId: string): boolean {
    if (!this.tabs.has(tabId)) return false;
    this.activeTabId = tabId;
    this.layout();
    return true;
  }

  reload(): boolean {
    const view = this.activeView();
    if (!view) return false;
    view.webContents.reload();
    return true;
  }

  stop(): boolean {
    const view = this.activeView();
    if (!view) return false;
    view.webContents.stop();
    return true;
  }

  closeTab(tabId: string): boolean {
    const view = this.tabs.get(tabId);
    if (!view) return false;
    this.tabs.delete(tabId);
    this.mainWindow.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
    if (this.activeTabId === tabId) {
      const nextTab = [...this.tabs.keys()].at(-1);
      this.activeTabId = nextTab;
    }
    this.layout();
    return true;
  }

  currentLink(): ResearchCurrentLink | undefined {
    const view = this.activeView();
    if (!view || view.webContents.isDestroyed()) return undefined;
    const url = view.webContents.getURL();
    if (!isAllowedResearchUrl(url) || url.length > MAX_LINK_URL_LENGTH) {
      return undefined;
    }
    const title = (view.webContents.getTitle().trim() || new URL(url).hostname)
      .slice(0, MAX_LINK_TITLE_LENGTH)
      .trim();
    return title ? { title, url } : undefined;
  }

  private createTab(): { id: string; view: WebContentsView } {
    if (this.tabs.size >= MAX_RESEARCH_TABS) {
      const oldestTabId = this.tabs.keys().next().value;
      if (oldestTabId) this.closeTab(oldestTabId);
    }
    const id = `research-${this.nextTabId++}`;
    const view = this.createView({
      webPreferences: createResearchWebPreferences(),
    });
    this.configure(view);
    this.tabs.set(id, view);
    this.activeTabId = id;
    this.mainWindow.contentView.addChildView(view);
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    return { id, view };
  }

  private activeView(): WebContentsView | undefined {
    return this.activeTabId ? this.tabs.get(this.activeTabId) : undefined;
  }

  private async openTabUrl(url: string): Promise<void> {
    if (!isAllowedResearchUrl(url)) return;
    const tab = this.createTab();
    try {
      await tab.view.webContents.loadURL(url);
      this.layout();
    } catch {
      try {
        if (isAllowedResearchUrl(tab.view.webContents.getURL())) {
          this.layout();
          return;
        }
      } catch {
        // Close the tab when no safe page reached the view.
      }
      this.closeTab(tab.id);
    }
  }

  private async extractSearchResults(
    view: WebContentsView,
  ): Promise<ResearchSearchResult[]> {
    for (
      let attempt = 0;
      attempt < GOOGLE_RESULT_EXTRACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const candidates = await view.webContents.executeJavaScript(
          GOOGLE_RESULT_EXTRACTOR,
          true,
        );
        const results = normalizeResearchSearchResults(candidates);
        if (
          results.length > 0 ||
          attempt === GOOGLE_RESULT_EXTRACTION_ATTEMPTS - 1
        )
          return results;
      } catch {
        if (attempt === GOOGLE_RESULT_EXTRACTION_ATTEMPTS - 1) return [];
      }
      await new Promise((resolve) =>
        setTimeout(resolve, GOOGLE_RESULT_EXTRACTION_INTERVAL_MS),
      );
    }
    return [];
  }

  private toTabInfo(id: string, view: WebContentsView): ResearchTabInfo {
    const webContents = view.webContents;
    let url = '';
    try {
      const candidate = webContents.getURL();
      if (isAllowedResearchUrl(candidate))
        url = candidate.slice(0, MAX_LINK_URL_LENGTH);
    } catch {
      url = '';
    }
    return {
      id,
      title: webContents.getTitle().trim().slice(0, MAX_LINK_TITLE_LENGTH),
      url,
      loading: webContents.isLoading(),
    };
  }

  private configure(view: WebContentsView): void {
    const { webContents } = view;
    webContents.session.setPermissionCheckHandler(() => false);
    webContents.session.setPermissionRequestHandler(
      (_webContents, _permission, callback) => callback(false),
    );
    webContents.session.on('will-download', (event) => event.preventDefault());
    webContents.setWindowOpenHandler(({ url }) => {
      void this.openTabUrl(url);
      return { action: 'deny' };
    });
    webContents.on('will-navigate', (event, url) => {
      if (!isAllowedResearchUrl(url)) event.preventDefault();
    });
    webContents.on('will-redirect', (event, url) => {
      if (!isAllowedResearchUrl(url)) event.preventDefault();
    });
  }

  private isGoogleSearchPage(view: WebContentsView): boolean {
    if (!view || view.webContents.isDestroyed()) return false;
    try {
      const url = new URL(view.webContents.getURL());
      return url.hostname.endsWith('.google.com') && url.pathname === '/search';
    } catch {
      return false;
    }
  }

  private layout(): void {
    if (this.mainWindow.isDestroyed()) return;
    const { width, height } = this.mainWindow.getContentBounds();
    const availableHeight = Math.max(0, height - MAIN_HEADER_HEIGHT);
    const workbenchHeight = Math.min(
      availableHeight,
      Math.min(
        MAX_RESEARCH_WORKBENCH_HEIGHT,
        Math.max(
          MIN_RESEARCH_WORKBENCH_HEIGHT,
          Math.floor(height * RESEARCH_WORKBENCH_HEIGHT_RATIO),
        ),
      ),
    );
    for (const view of this.tabs.values())
      view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    const view = this.activeView();
    if (!view) return;
    view.setBounds({
      x: 0,
      y: MAIN_HEADER_HEIGHT + RESEARCH_TOOLBAR_HEIGHT,
      width: Math.floor(width * 0.52),
      height: Math.max(0, workbenchHeight - RESEARCH_TOOLBAR_HEIGHT),
    });
  }
}
