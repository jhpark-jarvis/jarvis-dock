import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    expect(screen.getByText('열어 둔 문서가 없습니다.')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: '폴더 선택' })).toHaveFocus();

    await user.tab();
    expect(
      screen.getByRole('textbox', { name: 'Markdown 편집기' }),
    ).toHaveFocus();
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
    expect(screen.getByRole('button', { name: /\/image/ })).toHaveFocus();
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
    await user.click(screen.getByRole('button', { name: '명령 팔레트 열기' }));
    await user.click(screen.getByRole('button', { name: /\/image/ }));
    await user.type(
      screen.getByRole('textbox', { name: '이미지 검색어' }),
      'electron',
    );
    await user.click(screen.getByRole('button', { name: '검색' }));
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
