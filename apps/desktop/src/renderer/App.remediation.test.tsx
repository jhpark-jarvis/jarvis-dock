import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const workspaceId = '11111111-1111-4111-8111-111111111111';

const chooseWorkspace = async () => ({
  ok: true as const,
  value: { workspaceId, displayName: 'notes' },
});

describe('App remediation regressions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the move conflict message as a visible alert', async () => {
    const entries = [
      {
        relativePath: 'source.md',
        displayName: 'source.md',
        kind: 'file' as const,
      },
      {
        relativePath: 'archive',
        displayName: 'archive',
        kind: 'directory' as const,
      },
      {
        relativePath: 'archive/source.md',
        displayName: 'source.md',
        kind: 'file' as const,
      },
    ];
    const moveEntry = vi.fn(async () => ({
      ok: false as const,
      error: {
        code: 'WRITE_FAILED' as const,
        message: 'A file or folder with that name already exists.',
      },
    }));

    Object.defineProperty(window, 'dock', {
      configurable: true,
      value: {
        workspace: {
          choose: chooseWorkspace,
          listEntries: async () => ({
            ok: true as const,
            value: { entries },
          }),
          moveEntry,
        },
      },
    });
    render(<App />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '폴더 선택' }));
    const source = screen.getByRole('button', { name: 'source.md' });
    const target = screen.getByRole('button', { name: 'archive' });
    const sourceRow = source.closest('.workspace-tree__row');
    const targetRow = target.closest('.workspace-tree__row');
    if (!sourceRow || !targetRow) throw new Error('Explorer rows not found.');

    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(() => 'source.md'),
    };
    fireEvent.dragStart(sourceRow, { dataTransfer });
    fireEvent.drop(targetRow, { dataTransfer });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        '대상 폴더에 같은 이름의 파일 또는 폴더가 이미 있습니다.',
      ),
    );
    expect(moveEntry).toHaveBeenCalledWith({
      workspaceId,
      relativePath: 'source.md',
      destinationParentPath: 'archive',
    });
  });

  it('keeps an unsaved draft when the selected document is renamed', async () => {
    const user = userEvent.setup();
    let entries = [
      {
        relativePath: 'today.md',
        displayName: 'today.md',
        kind: 'file' as const,
      },
    ];
    let changed: ((event: { workspaceId: string }) => void) | undefined;
    const renameEntry = vi.fn(async () => {
      entries = [
        { relativePath: 'renamed.md', displayName: 'renamed.md', kind: 'file' },
      ];
      changed?.({ workspaceId });
      return {
        ok: true as const,
        value: { relativePath: 'renamed.md', kind: 'file' as const },
      };
    });

    Object.defineProperty(window, 'dock', {
      configurable: true,
      value: {
        workspace: {
          choose: chooseWorkspace,
          listEntries: async () => ({
            ok: true as const,
            value: { entries },
          }),
          onChanged: (callback: (event: { workspaceId: string }) => void) => {
            changed = callback;
            return () => {
              changed = undefined;
            };
          },
          renameEntry,
        },
        document: {
          read: async () => ({
            ok: true as const,
            value: {
              relativePath: 'today.md',
              content: '# Before',
              revision: 'revision-1',
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
    await user.click(
      screen.getByRole('button', { name: 'today.md 이름 변경' }),
    );
    const renameInput = screen.getByRole('textbox', {
      name: 'today.md 이름 변경 입력',
    });
    await user.clear(renameInput);
    await user.type(renameInput, 'renamed.md');
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(
        screen.getByRole('textbox', { name: 'Markdown 편집기' }),
      ).toHaveValue('# Before\nUnsaved'),
    );
    expect(renameEntry).toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'renamed.md' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('restores editor focus after cancelling an unsaved document switch', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'dock', {
      configurable: true,
      value: {
        workspace: {
          choose: chooseWorkspace,
          listMarkdownFiles: async () => ({
            ok: true as const,
            value: {
              files: [
                { relativePath: 'a.md', displayName: 'a.md' },
                { relativePath: 'b.md', displayName: 'b.md' },
              ],
            },
          }),
        },
        document: {
          read: async ({ relativePath }: { relativePath: string }) => ({
            ok: true as const,
            value: {
              relativePath,
              content: relativePath === 'a.md' ? '# A' : '# B',
              revision: relativePath,
            },
          }),
        },
      },
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);

    await user.click(screen.getByRole('button', { name: '폴더 선택' }));
    await user.click(await screen.findByRole('button', { name: 'a.md' }));
    const editor = screen.getByRole('textbox', { name: 'Markdown 편집기' });
    await user.type(editor, '\nUnsaved');
    await user.click(screen.getByRole('button', { name: 'b.md' }));

    await waitFor(() => expect(editor).toHaveFocus());
    expect(confirm).toHaveBeenCalledWith(
      '저장하지 않은 변경 사항이 있습니다. 다른 문서를 열까요?',
    );
    expect(editor).toHaveValue('# A\nUnsaved');
  });
});
