import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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
        search: {
          links: async () => ({
            ok: true as const,
            value: {
              results: [
                {
                  title: 'Electron Security',
                  url: 'https://www.electronjs.org/docs/latest/tutorial/security',
                  source: 'Electron documentation',
                },
              ],
            },
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
    await user.type(screen.getByLabelText('Brave Search API key'), 'test-key');
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(
      screen.getByRole('textbox', { name: 'Markdown 편집기' }),
    ).toHaveValue('# Today\nEdited');
    await user.click(screen.getByRole('button', { name: '명령 팔레트 열기' }));
    await user.click(screen.getByRole('button', { name: /\/link/ }));
    await user.type(screen.getByLabelText('Brave Search API key'), 'test-key');
    await user.type(
      screen.getByRole('textbox', { name: '링크 검색어' }),
      'electron',
    );
    await user.click(screen.getByRole('button', { name: '검색' }));
    await user.click(
      await screen.findByRole('button', { name: /Electron Security/ }),
    );
    expect(
      screen.getByRole('textbox', { name: 'Markdown 편집기' }),
    ).toHaveValue(
      '# Today\nEdited[Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)',
    );
  });

  it('searches mock images and keeps the document unchanged before download', async () => {
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
      '다운로드 기능은 다음 단계에서 연결합니다.',
    );
    expect(
      screen.getByRole('textbox', { name: 'Markdown 편집기' }),
    ).toHaveValue('# Today');
  });
});
