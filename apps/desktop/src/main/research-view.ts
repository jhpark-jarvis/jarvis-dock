import {
  WebContentsView,
  type BrowserWindow,
  type WebContentsViewConstructorOptions,
} from 'electron';
import { isAllowedLinkUrl } from '../shared/link';
import {
  ResearchSearchResultSchema,
  type ResearchSearchResult,
} from '../shared/ipc';

const GOOGLE_SEARCH_URL = 'https://www.google.com/search';
const RESEARCH_PARTITION = 'dock-research';
const RESEARCH_TOOLBAR_HEIGHT = 72;
const MAX_LINK_TITLE_LENGTH = 500;
const MAX_LINK_URL_LENGTH = 2048;
const MAX_RESEARCH_RESULTS = 10;

const GOOGLE_RESULT_EXTRACTOR = `
(() => Array.from(document.querySelectorAll('a')).flatMap((anchor) => {
  const heading = anchor.querySelector('h3');
  const title = heading?.textContent?.replace(/\\s+/g, ' ').trim();
  const href = anchor.href;
  return title && href ? [{ title, href }] : [];
}))()
`;

export interface ResearchCurrentLink {
  title: string;
  url: string;
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
  private view: WebContentsView | undefined;

  constructor(
    private readonly mainWindow: BrowserWindow,
    private readonly createView: ResearchViewFactory = createResearchView,
  ) {
    mainWindow.on('resize', () => this.layout());
    mainWindow.once('close', () => this.close());
  }

  async open(query: string): Promise<ResearchSearchResult[]> {
    if (!this.view) {
      this.view = this.createView({
        webPreferences: createResearchWebPreferences(),
      });
      this.configure(this.view);
      this.mainWindow.contentView.addChildView(this.view);
    }

    this.layout();
    await this.view.webContents.loadURL(createGoogleSearchUrl(query));
    if (!this.isGoogleSearchPage()) return [];
    try {
      const candidates = await this.view.webContents.executeJavaScript(
        GOOGLE_RESULT_EXTRACTOR,
        true,
      );
      return normalizeResearchSearchResults(candidates);
    } catch {
      return [];
    }
  }

  close(): void {
    const view = this.view;
    if (!view) return;
    this.view = undefined;
    this.mainWindow.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
  }

  currentLink(): ResearchCurrentLink | undefined {
    const view = this.view;
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

  private configure(view: WebContentsView): void {
    const { webContents } = view;
    webContents.session.setPermissionCheckHandler(() => false);
    webContents.session.setPermissionRequestHandler(
      (_webContents, _permission, callback) => callback(false),
    );
    webContents.session.on('will-download', (event) => event.preventDefault());
    webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    webContents.on('will-navigate', (event, url) => {
      if (!isAllowedResearchUrl(url)) event.preventDefault();
    });
    webContents.on('will-redirect', (event, url) => {
      if (!isAllowedResearchUrl(url)) event.preventDefault();
    });
  }

  private isGoogleSearchPage(): boolean {
    const view = this.view;
    if (!view || view.webContents.isDestroyed()) return false;
    try {
      const url = new URL(view.webContents.getURL());
      return url.hostname.endsWith('.google.com') && url.pathname === '/search';
    } catch {
      return false;
    }
  }

  private layout(): void {
    const view = this.view;
    if (!view || this.mainWindow.isDestroyed()) return;
    const { width, height } = this.mainWindow.getContentBounds();
    const x = Math.floor(width * 0.52);
    view.setBounds({
      x,
      y: RESEARCH_TOOLBAR_HEIGHT,
      width: Math.max(0, width - x),
      height: Math.max(0, height - RESEARCH_TOOLBAR_HEIGHT),
    });
  }
}
