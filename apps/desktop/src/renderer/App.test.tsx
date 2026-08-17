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
    const listMarkdownFiles = async () => ({
      ok: true as const,
      value: { files: [{ relativePath: 'today.md', displayName: 'today.md' }] },
    });
    const read = async () => ({
      ok: true as const,
      value: { relativePath: 'today.md', content: '# Today' },
    });
    const write = async () => ({
      ok: true as const,
      value: { relativePath: 'today.md', bytesWritten: 8 },
    });
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
          create: async () => ({
            ok: true,
            value: { relativePath: 'today.md', bytesWritten: 0 },
          }),
          write,
        },
      },
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '폴더 선택' }));
    expect(
      await screen.findByRole('button', { name: 'today.md' }),
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
  });
});
