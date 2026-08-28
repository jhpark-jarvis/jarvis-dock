import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the accessible application shell and its empty states', () => {
    render(<App />);

    expect(
      screen.getByRole('main', { name: 'Dock 작업 공간' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Dock', level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('complementary', { name: '문서' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '새 문서' })).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '미리보기' }),
    ).toBeInTheDocument();
    expect(screen.getByText('선택된 폴더가 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('미리볼 문서가 없습니다.')).toBeInTheDocument();
  });

  it('keeps the command, document selection, and editor in keyboard focus order', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.tab();
    expect(
      screen.getByRole('button', { name: '명령 팔레트 열기' }),
    ).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: '탐색기' })).toHaveFocus();

    await user.tab();
    expect(
      screen.getByRole('button', { name: '문서 개요 열기' }),
    ).toHaveFocus();

    await user.tab();
    expect(
      screen.getByRole('button', { name: '이미지 자산 열기' }),
    ).toHaveFocus();

    await user.tab();
    expect(
      screen.getByRole('button', { name: '프로젝트 설계 문서 열기' }),
    ).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: '폴더 선택' })).toHaveFocus();

    await user.tab();
    expect(
      screen.getByRole('button', { name: '탐색기 패널 접기' }),
    ).toHaveFocus();

    await user.tab();
    expect(
      screen.getByRole('textbox', { name: 'Markdown 편집기' }),
    ).toHaveFocus();
  });

  it('collapses and reopens the Explorer without removing the editor or preview', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '탐색기 패널 접기' }));

    expect(
      screen.queryByRole('complementary', { name: '문서' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '탐색기 열기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(
      screen.getByRole('textbox', { name: 'Markdown 편집기' }),
    ).toBeVisible();
    expect(screen.getByRole('region', { name: '미리보기' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: '탐색기 열기' }));

    expect(screen.getByRole('complementary', { name: '문서' })).toBeVisible();
    expect(screen.getByRole('button', { name: '탐색기' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('offers editor commands and opens the matching command flow with Tab', async () => {
    const user = userEvent.setup();
    render(<App />);
    const editor = screen.getByRole('textbox', { name: 'Markdown 편집기' });

    await user.click(editor);
    await user.type(editor, '/link');
    expect(
      screen.getByRole('toolbar', { name: '문서 명령 제안' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /링크 검색/ }),
    ).toBeInTheDocument();

    await user.keyboard('{Tab}');

    expect(
      screen.getByRole('dialog', { name: '명령 팔레트' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: '링크 검색어' }),
    ).toBeInTheDocument();
    expect(editor).toHaveValue('');
  });

  it('opens image search when the editor image command suggestion is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    const editor = screen.getByRole('textbox', { name: 'Markdown 편집기' });

    await user.click(editor);
    await user.type(editor, '/image');
    await user.click(screen.getByRole('button', { name: /이미지 검색/ }));

    expect(
      screen.getByRole('textbox', { name: '이미지 검색어' }),
    ).toBeInTheDocument();
    expect(editor).toHaveValue('');
  });

  it('opens the document outline and moves the editor to a selected heading', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'dock', {
      configurable: true,
      value: {
        workspace: {
          choose: async () => ({
            ok: true as const,
            value: {
              workspaceId: '11111111-1111-4111-8111-111111111111',
              displayName: 'notes',
            },
          }),
          listMarkdownFiles: async () => ({
            ok: true as const,
            value: {
              files: [{ relativePath: 'guide.md', displayName: 'guide.md' }],
            },
          }),
        },
        document: {
          read: async () => ({
            ok: true as const,
            value: {
              relativePath: 'guide.md',
              content: '# Start\n\n## Install\n\n## Usage',
            },
          }),
        },
      },
    });
    render(<App />);

    await user.click(screen.getByRole('button', { name: '폴더 선택' }));
    await user.click(await screen.findByRole('button', { name: 'guide.md' }));
    await user.click(screen.getByRole('button', { name: '문서 개요 열기' }));

    expect(
      screen.getByRole('complementary', { name: '문서 개요' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: /^Usage #5$/ }));

    const editor = screen.getByRole('textbox', { name: 'Markdown 편집기' });
    expect(editor).toHaveFocus();
    expect(editor).toHaveProperty('selectionStart', 21);
    expect(editor).toHaveProperty('selectionEnd', 21);
  });

  it('opens the architecture document panel from the Activity Bar', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', { name: '프로젝트 설계 문서 열기' }),
    );

    expect(
      screen.getByRole('complementary', { name: '프로젝트 설계 문서' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: '문서 세트 초기화' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: '정합성 점검' })).toBeDisabled();
    expect(screen.getByText('선택된 폴더가 없습니다.')).toBeVisible();
  });

  it('opens image assets and inserts an existing asset at the editor selection', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'dock', {
      configurable: true,
      value: {
        workspace: {
          choose: async () => ({
            ok: true as const,
            value: {
              workspaceId: '11111111-1111-4111-8111-111111111111',
              displayName: 'notes',
            },
          }),
          listMarkdownFiles: async () => ({
            ok: true as const,
            value: {
              files: [{ relativePath: 'guide.md', displayName: 'guide.md' }],
            },
          }),
        },
        document: {
          read: async () => ({
            ok: true as const,
            value: {
              relativePath: 'guide.md',
              content: '# Guide',
            },
          }),
        },
        image: {
          list: async () => ({
            ok: true as const,
            value: {
              assets: [
                { assetPath: 'assets/diagram.png', displayName: 'diagram.png' },
              ],
            },
          }),
          read: async () => ({
            ok: true as const,
            value: {
              assetPath: 'assets/diagram.png',
              dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
              mimeType: 'image/png' as const,
            },
          }),
        },
      },
    });
    render(<App />);

    await user.click(screen.getByRole('button', { name: '폴더 선택' }));
    await user.click(await screen.findByRole('button', { name: 'guide.md' }));
    await user.click(screen.getByRole('button', { name: '이미지 자산 열기' }));

    expect(
      screen.getByRole('complementary', { name: '이미지 자산' }),
    ).toBeVisible();
    const assetButton = await screen.findByRole('button', {
      name: /diagram\.png assets\/diagram\.png/,
    });
    expect(assetButton).toBeVisible();
    await user.click(assetButton);

    expect(
      screen.getByRole('textbox', { name: 'Markdown 편집기' }),
    ).toHaveValue('# Guide![diagram](./assets/diagram.png)');
  });

  it('opens the command palette as a dialog and closes it with Escape', async () => {
    const user = userEvent.setup();
    render(<App />);

    const trigger = screen.getByRole('button', { name: '명령 팔레트 열기' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);

    expect(screen.getByRole('dialog', { name: '명령 팔레트' })).toBeVisible();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '닫기' })).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: /^ADR 작성/ })).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(screen.getByRole('button', { name: '닫기' })).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(
      screen.queryByRole('dialog', { name: '명령 팔레트' }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('shows loading and error messages as distinct accessible states', () => {
    const { rerender } = render(<App state="loading" />);

    expect(screen.getByRole('status')).toHaveTextContent(
      '문서 목록을 준비하고 있습니다.',
    );

    rerender(<App state="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      '문서 목록을 불러오지 못했습니다.',
    );
  });

  it('renders a Mermaid diagram after opening a Markdown document', async () => {
    Object.defineProperty(window, 'dock', {
      configurable: true,
      value: {
        workspace: {
          choose: async () => ({
            ok: true as const,
            value: {
              workspaceId: '11111111-1111-4111-8111-111111111111',
              displayName: 'notes',
            },
          }),
          listMarkdownFiles: async () => ({
            ok: true as const,
            value: {
              files: [{ relativePath: 'guide.md', displayName: 'guide.md' }],
            },
          }),
        },
        document: {
          read: async () => ({
            ok: true as const,
            value: {
              relativePath: 'guide.md',
              content:
                '```mermaid\nflowchart LR\n  A[Start] --> B[Finish]\n```',
            },
          }),
        },
      },
    });
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole('button', { name: '폴더 선택' }));
    await user.click(await screen.findByRole('button', { name: 'guide.md' }));

    await waitFor(() => {
      expect(container.querySelector('.mermaid-diagram svg')).toBeTruthy();
    });
    expect(
      screen.queryByText('Mermaid 미리보기를 준비하고 있습니다.'),
    ).not.toBeInTheDocument();
  });

  it('opens the Architecture Workspace initializer from the command palette', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '명령 팔레트 열기' }));
    await user.click(
      within(screen.getByRole('dialog', { name: '명령 팔레트' })).getByRole(
        'button',
        { name: /프로젝트 설계 문서/ },
      ),
    );

    expect(screen.getByLabelText('프로젝트 이름')).toBeVisible();
    expect(screen.getByLabelText('무엇을 만들고 있나요?')).toBeVisible();
    expect(screen.getByText('docs/architecture/arc42.md')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '문서 세트 생성' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '먼저 문서 폴더를 선택해 주세요.',
    );
  });

  it('opens the ADR form and requires a selected document workspace', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '명령 팔레트 열기' }));
    await user.click(screen.getByRole('button', { name: /^ADR 작성/ }));

    expect(screen.getByLabelText('결정 제목')).toBeVisible();
    expect(screen.getByLabelText('상태')).toBeVisible();
    await user.type(screen.getByLabelText('결정 제목'), 'ADR 테스트');
    await user.type(screen.getByLabelText('배경'), '배경 테스트');
    await user.type(screen.getByLabelText('결정'), '결정 테스트');
    await user.type(screen.getByLabelText('결과'), '결과 테스트');
    await user.click(screen.getByRole('button', { name: 'ADR 생성' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '먼저 문서 폴더를 선택해 주세요.',
    );
  });

  it('keeps the Architecture Workspace draft while selecting its folder', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'dock', {
      configurable: true,
      value: {
        workspace: {
          choose: async () => ({
            ok: true as const,
            value: {
              workspaceId: '11111111-1111-4111-8111-111111111111',
              displayName: 'architecture-notes',
            },
          }),
          listMarkdownFiles: async () => ({
            ok: true as const,
            value: {
              files: [] as Array<{
                relativePath: string;
                displayName: string;
              }>,
            },
          }),
        },
      },
    });
    render(<App />);

    await user.click(screen.getByRole('button', { name: '명령 팔레트 열기' }));
    await user.click(
      within(screen.getByRole('dialog', { name: '명령 팔레트' })).getByRole(
        'button',
        { name: /프로젝트 설계 문서/ },
      ),
    );
    await user.type(screen.getByLabelText('프로젝트 이름'), 'Dock');
    await user.type(
      screen.getByLabelText('무엇을 만들고 있나요?'),
      '로컬 문서 작업 공간',
    );

    await user.click(
      within(screen.getByRole('dialog', { name: '명령 팔레트' })).getByRole(
        'button',
        { name: '닫기' },
      ),
    );
    await user.click(screen.getByRole('button', { name: '명령 팔레트 열기' }));
    await user.click(
      within(screen.getByRole('dialog', { name: '명령 팔레트' })).getByRole(
        'button',
        { name: /프로젝트 설계 문서/ },
      ),
    );
    expect(screen.getByLabelText('프로젝트 이름')).toHaveValue('Dock');
    expect(screen.getByLabelText('무엇을 만들고 있나요?')).toHaveValue(
      '로컬 문서 작업 공간',
    );

    await user.click(
      within(screen.getByRole('dialog', { name: '명령 팔레트' })).getByRole(
        'button',
        { name: '폴더 선택' },
      ),
    );

    expect((await screen.findAllByText('architecture-notes'))[0]).toBeVisible();
    expect(screen.getByLabelText('프로젝트 이름')).toHaveValue('Dock');
    expect(screen.getByLabelText('무엇을 만들고 있나요?')).toHaveValue(
      '로컬 문서 작업 공간',
    );
    expect(screen.getByRole('button', { name: '폴더 변경' })).toBeVisible();
  });

  it('keeps the ADR draft while selecting its folder', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'dock', {
      configurable: true,
      value: {
        workspace: {
          choose: async () => ({
            ok: true as const,
            value: {
              workspaceId: '22222222-2222-4222-8222-222222222222',
              displayName: 'adr-notes',
            },
          }),
          listMarkdownFiles: async () => ({
            ok: true as const,
            value: {
              files: [] as Array<{
                relativePath: string;
                displayName: string;
              }>,
            },
          }),
        },
      },
    });
    render(<App />);

    await user.click(screen.getByRole('button', { name: '명령 팔레트 열기' }));
    await user.click(screen.getByRole('button', { name: /^ADR 작성/ }));
    await user.type(screen.getByLabelText('결정 제목'), '폴더 선택 흐름');
    await user.type(
      screen.getByLabelText('배경'),
      '작성 중인 초안을 보존해야 합니다.',
    );

    await user.click(
      within(screen.getByRole('dialog', { name: '명령 팔레트' })).getByRole(
        'button',
        { name: '폴더 선택' },
      ),
    );

    expect((await screen.findAllByText('adr-notes'))[0]).toBeVisible();
    expect(screen.getByLabelText('결정 제목')).toHaveValue('폴더 선택 흐름');
    expect(screen.getByLabelText('배경')).toHaveValue(
      '작성 중인 초안을 보존해야 합니다.',
    );
    expect(screen.getByRole('button', { name: '폴더 변경' })).toBeVisible();
  });

  it('keeps unsaved text and reports a save failure', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'dock', {
      configurable: true,
      value: {
        workspace: {
          choose: async () => ({
            ok: true as const,
            value: {
              workspaceId: '11111111-1111-4111-8111-111111111111',
              displayName: 'notes',
            },
          }),
          listMarkdownFiles: async () => ({
            ok: true as const,
            value: {
              files: [{ relativePath: 'today.md', displayName: 'today.md' }],
            },
          }),
        },
        document: {
          read: async () => ({
            ok: true as const,
            value: { relativePath: 'today.md', content: '# Before' },
          }),
          write: async () => ({
            ok: false as const,
            error: {
              code: 'PERMISSION_DENIED' as const,
              message: 'Permission was denied.',
            },
          }),
        },
      },
    });
    render(<App />);

    await user.click(screen.getByRole('button', { name: '폴더 선택' }));
    await user.click(await screen.findByRole('button', { name: 'today.md' }));
    const editor = screen.getByRole('textbox', { name: 'Markdown 편집기' });
    await user.type(editor, '\nUnsaved');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      '문서를 저장하지 못했습니다. 편집 내용은 유지됩니다.',
    );
    expect(editor).toHaveValue('# Before\nUnsaved');
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
  });

  it('connects folder selection, opening, editing, and saving through the narrow API', async () => {
    const choose = async () => ({
      ok: true as const,
      value: {
        workspaceId: '11111111-1111-4111-8111-111111111111',
        displayName: 'notes',
      },
    });
    let files = [{ relativePath: 'today.md', displayName: 'today.md' }];
    const listMarkdownFiles = async () => ({
      ok: true as const,
      value: { files },
    });
    const read = async () => ({
      ok: true as const,
      value: { relativePath: 'today.md', content: '# Today' },
    });
    const write = async () => ({
      ok: true as const,
      value: { relativePath: 'today.md', bytesWritten: 8 },
    });
    const create = async ({ relativePath }: { relativePath: string }) => {
      files = [...files, { relativePath, displayName: relativePath }];
      return {
        ok: true as const,
        value: { relativePath, bytesWritten: 0 },
      };
    };
    Object.defineProperty(window, 'dock', {
      configurable: true,
      value: {
        system: {
          health: async () => ({ ok: true, value: { status: 'ok' } }),
          version: async () => ({ ok: true, value: { version: '1.0.0' } }),
        },
        workspace: { choose, listMarkdownFiles },
        document: {
          read,
          create,
          write,
        },
        research: {
          open: async () => ({
            ok: true as const,
            value: {
              opened: true,
              results: [
                {
                  title: 'Electron Security',
                  url: 'https://www.electronjs.org/docs/latest/tutorial/security',
                },
              ],
            },
          }),
          close: async () => ({
            ok: true as const,
            value: { closed: true },
          }),
          currentLink: async () => ({
            ok: true as const,
            value: {
              title: 'Electron Security',
              url: 'https://www.electronjs.org/docs/latest/tutorial/security',
            },
          }),
          info: async () => ({
            ok: true as const,
            value: {
              activeTabId: 'research-1',
              tabs: [
                {
                  id: 'research-1',
                  title: 'Google Search',
                  url: 'https://www.google.com/search?q=electron',
                  loading: false,
                },
              ],
            },
          }),
          selectTab: async () => ({
            ok: true as const,
            value: { updated: true },
          }),
          reload: async () => ({
            ok: true as const,
            value: { updated: true },
          }),
          stop: async () => ({
            ok: true as const,
            value: { updated: true },
          }),
          closeTab: async () => ({
            ok: true as const,
            value: { updated: true },
          }),
        },
      },
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '폴더 선택' }));
    expect(
      await screen.findByRole('button', { name: 'today.md' }),
    ).toBeInTheDocument();
    const newDocumentPath = screen.getByRole('textbox', {
      name: '새 문서 경로',
    });
    await user.clear(newDocumentPath);
    await user.type(newDocumentPath, 'new-note.md');
    await user.click(screen.getByRole('button', { name: '새 문서 생성' }));
    expect(
      await screen.findByRole('button', { name: 'new-note.md' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'today.md' }));
    expect(await screen.findByDisplayValue('# Today')).toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: 'Markdown 편집기' }),
      '\nEdited',
    );
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(
      await screen.findByRole('button', { name: '저장됨' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '명령 팔레트 열기' }));
    await user.click(screen.getByRole('button', { name: /\/link/ }));
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(
      screen.getByRole('textbox', { name: 'Markdown 편집기' }),
    ).toHaveValue('# Today\nEdited');
    await user.click(screen.getByRole('button', { name: '명령 팔레트 열기' }));
    await user.click(screen.getByRole('button', { name: /\/link/ }));
    await user.type(
      screen.getByRole('textbox', { name: '링크 검색어' }),
      'electron',
    );
    await user.click(
      screen.getByRole('button', { name: 'Research View 열기' }),
    );
    expect(
      await screen.findByRole('tab', { name: 'Google Search' }),
    ).toHaveAttribute('aria-selected', 'true');
    await user.click(
      screen.getByRole('button', { name: /^Electron Security/ }),
    );
    expect(
      screen.getByRole('textbox', { name: 'Markdown 편집기' }),
    ).toHaveValue(
      '# Today\nEdited[Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)',
    );
  });

  it('inserts a selected link at the editor selection captured before opening the palette', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'dock', {
      configurable: true,
      value: {
        workspace: {
          choose: async () => ({
            ok: true as const,
            value: {
              workspaceId: '11111111-1111-4111-8111-111111111111',
              displayName: 'notes',
            },
          }),
          listMarkdownFiles: async () => ({
            ok: true as const,
            value: {
              files: [{ relativePath: 'today.md', displayName: 'today.md' }],
            },
          }),
        },
        document: {
          read: async () => ({
            ok: true as const,
            value: { relativePath: 'today.md', content: '# Today' },
          }),
        },
        research: {
          open: async () => ({
            ok: true as const,
            value: {
              opened: true,
              results: [
                {
                  title: 'Electron Security',
                  url: 'https://www.electronjs.org/docs/latest/tutorial/security',
                },
              ],
            },
          }),
          close: async () => ({
            ok: true as const,
            value: { closed: true },
          }),
          currentLink: async () => ({
            ok: false as const,
            error: {
              code: 'RESEARCH_INVALID_PAGE' as const,
              message: 'The current research page cannot be inserted.',
            },
          }),
          info: async () => ({
            ok: true as const,
            value: {
              activeTabId: 'research-1',
              tabs: [
                {
                  id: 'research-1',
                  title: 'Google Search',
                  url: 'https://www.google.com/search?q=electron',
                  loading: false,
                },
              ],
            },
          }),
          selectTab: async () => ({
            ok: true as const,
            value: { updated: true },
          }),
          reload: async () => ({
            ok: true as const,
            value: { updated: true },
          }),
          stop: async () => ({
            ok: true as const,
            value: { updated: true },
          }),
          closeTab: async () => ({
            ok: true as const,
            value: { updated: true },
          }),
        },
      },
    });
    render(<App />);

    await user.click(screen.getByRole('button', { name: '폴더 선택' }));
    await user.click(await screen.findByRole('button', { name: 'today.md' }));
    const editor = screen.getByRole('textbox', {
      name: 'Markdown 편집기',
    }) as HTMLTextAreaElement;
    editor.setSelectionRange(2, 2);
    fireEvent.select(editor);

    await user.click(screen.getByRole('button', { name: '명령 팔레트 열기' }));
    await user.click(screen.getByRole('button', { name: /\/link/ }));
    await user.type(
      screen.getByRole('textbox', { name: '링크 검색어' }),
      'electron',
    );
    await user.click(
      screen.getByRole('button', { name: 'Research View 열기' }),
    );
    await user.click(
      await screen.findByRole('button', { name: /^Electron Security/ }),
    );

    expect(editor).toHaveValue(
      '# [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)Today',
    );
  });

  it('inserts a link into the editable draft before a Markdown document is selected', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'dock', {
      configurable: true,
      value: {
        research: {
          open: async () => ({
            ok: true as const,
            value: {
              opened: true,
              results: [
                {
                  title: 'Electron Security',
                  url: 'https://www.electronjs.org/docs/latest/tutorial/security',
                },
              ],
            },
          }),
          info: async () => ({
            ok: true as const,
            value: {
              activeTabId: 'research-1',
              tabs: [
                {
                  id: 'research-1',
                  title: 'Google Search',
                  url: 'https://www.google.com/search?q=electron',
                  loading: false,
                },
              ],
            },
          }),
        },
      },
    });
    render(<App />);

    const editor = screen.getByRole('textbox', {
      name: 'Markdown 편집기',
    }) as HTMLTextAreaElement;
    editor.focus();
    editor.setSelectionRange(0, 0);
    fireEvent.select(editor);

    await user.click(screen.getByRole('button', { name: '명령 팔레트 열기' }));
    await user.click(screen.getByRole('button', { name: /\/link/ }));
    await user.type(
      screen.getByRole('textbox', { name: '링크 검색어' }),
      'electron',
    );
    await user.click(
      screen.getByRole('button', { name: 'Research View 열기' }),
    );
    await user.click(
      await screen.findByRole('button', { name: /^Electron Security/ }),
    );

    expect(editor).toHaveValue(
      '[Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)',
    );
  });

  it('mounts the Research workbench while the search request is still loading', async () => {
    const user = userEvent.setup();
    const response = {
      ok: true as const,
      value: {
        opened: true as const,
        results: [] as Array<{ title: string; url: string }>,
      },
    };
    let resolveOpen: (() => void) | undefined;
    const open = () =>
      new Promise<typeof response>((resolve) => {
        resolveOpen = () => resolve(response);
      });
    Object.defineProperty(window, 'dock', {
      configurable: true,
      value: {
        research: {
          open,
          info: async () => ({
            ok: true as const,
            value: {
              activeTabId: null as string | null,
              tabs: [] as Array<{
                id: string;
                title: string;
                url: string;
                loading: boolean;
              }>,
            },
          }),
        },
      },
    });
    render(<App />);

    await user.click(screen.getByRole('button', { name: '명령 팔레트 열기' }));
    await user.click(screen.getByRole('button', { name: /\/link/ }));
    await user.type(
      screen.getByRole('textbox', { name: '링크 검색어' }),
      'electron',
    );
    await user.click(
      screen.getByRole('button', { name: 'Research View 열기' }),
    );

    expect(
      screen.getByRole('region', { name: '실험적 링크 검색 결과' }),
    ).toBeInTheDocument();
    resolveOpen?.();
    await expect(
      screen.findByText(
        '카드 추출 결과가 없습니다. Research View에서 직접 탐색한 뒤 현재 페이지 링크를 삽입할 수 있습니다.',
      ),
    ).resolves.toBeInTheDocument();
  });

  it('saves a pasted clipboard image into assets and inserts its Markdown reference', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'dock', {
      configurable: true,
      value: {
        workspace: {
          choose: async () => ({
            ok: true as const,
            value: {
              workspaceId: '11111111-1111-4111-8111-111111111111',
              displayName: 'notes',
            },
          }),
          listMarkdownFiles: async () => ({
            ok: true as const,
            value: {
              files: [{ relativePath: 'guide.md', displayName: 'guide.md' }],
            },
          }),
        },
        document: {
          read: async () => ({
            ok: true as const,
            value: { relativePath: 'guide.md', content: '# Guide' },
          }),
        },
        image: {
          read: async () => ({
            ok: false as const,
            error: {
              code: 'NOT_FOUND' as const,
              message: 'The image asset was not found.',
            },
          }),
          saveClipboard: async () => ({
            ok: true as const,
            value: {
              assetPath: 'assets/pasted-image.png',
              bytesWritten: 8,
              mimeType: 'image/png' as const,
            },
          }),
        },
      },
    });
    render(<App />);

    await user.click(screen.getByRole('button', { name: '폴더 선택' }));
    await user.click(await screen.findByRole('button', { name: 'guide.md' }));
    const editor = screen.getByRole('textbox', {
      name: 'Markdown 편집기',
    });
    const file = {
      type: 'image/png',
      arrayBuffer: async () =>
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer,
    } as File;
    fireEvent.paste(editor, {
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
      },
    });

    await waitFor(() =>
      expect(editor).toHaveValue(
        '# Guide![붙여넣은 이미지](./assets/pasted-image.png)',
      ),
    );
  });

  it('asks before deleting removed image assets when saving a document', async () => {
    const user = userEvent.setup();
    const deleteAsset = vi.fn(async () => ({
      ok: true as const,
      value: { assetPath: 'assets/old.png', deleted: true },
    }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    Object.defineProperty(window, 'dock', {
      configurable: true,
      value: {
        workspace: {
          choose: async () => ({
            ok: true as const,
            value: {
              workspaceId: '11111111-1111-4111-8111-111111111111',
              displayName: 'notes',
            },
          }),
          listMarkdownFiles: async () => ({
            ok: true as const,
            value: {
              files: [{ relativePath: 'guide.md', displayName: 'guide.md' }],
            },
          }),
        },
        document: {
          read: async () => ({
            ok: true as const,
            value: {
              relativePath: 'guide.md',
              content: '# Guide\n![old](./assets/old.png)',
            },
          }),
          write: async () => ({
            ok: true as const,
            value: {
              relativePath: 'guide.md',
              bytesWritten: 7,
              savedAt: '2026-08-27T00:00:00.000Z',
            },
          }),
        },
        image: {
          read: async () => ({
            ok: false as const,
            error: {
              code: 'NOT_FOUND' as const,
              message: 'The image asset was not found.',
            },
          }),
          delete: deleteAsset,
        },
      },
    });
    render(<App />);

    await user.click(screen.getByRole('button', { name: '폴더 선택' }));
    await user.click(await screen.findByRole('button', { name: 'guide.md' }));
    const editor = screen.getByRole('textbox', {
      name: 'Markdown 편집기',
    });
    await user.clear(editor);
    await user.type(editor, '# Guide');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(window.confirm).toHaveBeenCalledWith(
      '본문에서 1개의 이미지 참조가 제거되었습니다.\n저장된 원본 파일도 삭제하시겠습니까?',
    );
    expect(deleteAsset).toHaveBeenCalledWith({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      assetPath: 'assets/old.png',
    });
    vi.mocked(window.confirm).mockRestore();
  });

  it('downloads a selected mock image before inserting its relative Markdown path', async () => {
    const user = userEvent.setup();
    const openFolder = vi.fn(async () => ({
      ok: true as const,
      value: { opened: true as const },
    }));
    Object.defineProperty(window, 'dock', {
      configurable: true,
      value: {
        workspace: {
          choose: async () => ({
            ok: true as const,
            value: {
              workspaceId: '11111111-1111-4111-8111-111111111111',
              displayName: 'notes',
            },
          }),
          listMarkdownFiles: async () => ({
            ok: true as const,
            value: {
              files: [{ relativePath: 'today.md', displayName: 'today.md' }],
            },
          }),
          openFolder,
        },
        document: {
          read: async () => ({
            ok: true as const,
            value: { relativePath: 'today.md', content: '# Today' },
          }),
        },
        image: {
          search: async () => ({
            ok: true as const,
            value: {
              results: [
                {
                  id: 'image-1',
                  title: 'Electron process model',
                  sourcePageUrl:
                    'https://commons.wikimedia.org/wiki/File:Electron',
                  thumbnailUrl: 'https://upload.wikimedia.org/thumb.png',
                  downloadUrl: 'https://upload.wikimedia.org/process.png',
                  source: 'Wikimedia Commons',
                  license: 'CC BY-SA 4.0',
                },
              ],
            },
          }),
          download: async () => ({
            ok: true as const,
            value: {
              assetPath: 'assets/electron-process-model.png',
              bytesWritten: 8,
              mimeType: 'image/png' as const,
            },
          }),
        },
      },
    });
    render(<App />);

    await user.click(screen.getByRole('button', { name: '폴더 선택' }));
    await user.click(await screen.findByRole('button', { name: 'today.md' }));
    await user.click(screen.getByRole('button', { name: '선택된 폴더 열기' }));
    expect(openFolder).toHaveBeenCalledWith({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      folder: 'document',
    });
    await user.click(screen.getByRole('button', { name: '명령 팔레트 열기' }));
    await user.click(screen.getByRole('button', { name: /\/image/ }));
    await user.click(screen.getByRole('button', { name: '이미지 폴더 열기' }));
    expect(openFolder).toHaveBeenLastCalledWith({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      folder: 'assets',
    });
    await user.type(
      screen.getByRole('textbox', { name: '이미지 검색어' }),
      'electron',
    );
    await user.click(screen.getByRole('button', { name: '검색' }));
    await expect(
      screen.findByRole('img', { name: 'Electron process model 썸네일' }),
    ).resolves.toBeInTheDocument();
    await user.click(
      await screen.findByRole('button', { name: /Electron process model/ }),
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Electron process model을(를) 선택했습니다.',
    );
    expect(
      screen.getByRole('textbox', { name: 'Markdown 편집기' }),
    ).toHaveValue('# Today');
    await user.click(screen.getByRole('button', { name: '다운로드 및 삽입' }));
    expect(
      screen.getByRole('textbox', { name: 'Markdown 편집기' }),
    ).toHaveValue(
      '# Today![Electron process model](./assets/electron-process-model.png)',
    );
  });
});
