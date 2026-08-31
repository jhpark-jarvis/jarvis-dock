import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceExplorer } from './WorkspaceExplorer';

const entries = [
  { relativePath: 'docs', displayName: 'docs', kind: 'directory' as const },
  {
    relativePath: 'archive',
    displayName: 'archive',
    kind: 'directory' as const,
  },
  {
    relativePath: 'docs/note.md',
    displayName: 'note.md',
    kind: 'file' as const,
  },
  {
    relativePath: 'readme.txt',
    displayName: 'readme.txt',
    kind: 'file' as const,
  },
];

describe('WorkspaceExplorer', () => {
  it('collapses folders and opens Markdown files while keeping other files read-only', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <WorkspaceExplorer
        entries={entries}
        onOpen={onOpen}
        onCreate={vi.fn()}
        onRename={vi.fn(async () => true)}
        onDelete={vi.fn()}
        onMove={vi.fn(async () => true)}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'docs/note.md' }),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole('button', { name: 'docs 폴더 접기' })
        .querySelector('svg'),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'docs/note.md' }).querySelector('svg'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'readme.txt' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'docs/note.md' }));
    expect(onOpen).toHaveBeenCalledWith('docs/note.md');

    await user.click(screen.getByRole('button', { name: 'docs 폴더 접기' }));
    expect(
      screen.queryByRole('button', { name: 'docs/note.md' }),
    ).not.toBeInTheDocument();
  });

  it('supports inline rename from double click and a context menu', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn(async () => true);
    render(
      <WorkspaceExplorer
        entries={entries}
        onOpen={vi.fn()}
        onCreate={vi.fn()}
        onRename={onRename}
        onDelete={vi.fn()}
        onMove={vi.fn(async () => true)}
      />,
    );

    const file = screen.getByRole('button', { name: 'docs/note.md' });
    await user.dblClick(file);
    const input = screen.getByRole('textbox', {
      name: 'note.md 이름 변경 입력',
    });
    await user.clear(input);
    await user.type(input, 'renamed.md');
    await user.keyboard('{Enter}');
    expect(onRename).toHaveBeenCalledWith('docs/note.md', 'renamed.md');

    fireEvent.contextMenu(screen.getByRole('button', { name: 'docs/note.md' }));
    expect(
      screen.getByRole('menu', { name: 'note.md 메뉴' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: '이름 변경' }),
    ).toBeInTheDocument();
  });

  it('uses an in-app create dialog for toolbar and context actions', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => true);
    render(
      <WorkspaceExplorer
        entries={entries}
        onOpen={vi.fn()}
        onCreate={onCreate}
        onRename={vi.fn(async () => true)}
        onDelete={vi.fn()}
        onMove={vi.fn(async () => true)}
      />,
    );

    await user.click(screen.getByRole('button', { name: '+ 파일' }));
    const dialog = screen.getByRole('dialog', {
      name: '새 Markdown 파일 만들기',
    });
    const input = within(dialog).getByRole('textbox', { name: '이름' });
    await user.clear(input);
    await user.type(input, 'new.md');
    await user.click(within(dialog).getByRole('button', { name: '생성' }));
    expect(onCreate).toHaveBeenCalledWith('', 'file', 'new.md');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.contextMenu(screen.getByRole('button', { name: 'docs' }));
    await user.click(screen.getByRole('menuitem', { name: '새 파일' }));
    expect(
      screen.getByRole('dialog', { name: '새 Markdown 파일 만들기' }),
    ).toBeInTheDocument();
  });

  it('keeps the create dialog open when the mutation fails', async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceExplorer
        entries={entries}
        onOpen={vi.fn()}
        onCreate={vi.fn(async () => false)}
        onRename={vi.fn(async () => true)}
        onDelete={vi.fn()}
        onMove={vi.fn(async () => true)}
        createError="같은 이름의 파일 또는 폴더가 이미 있습니다."
      />,
    );

    await user.click(screen.getByRole('button', { name: '+ 폴더' }));
    const dialog = screen.getByRole('dialog', { name: '새 폴더 만들기' });
    await user.click(within(dialog).getByRole('button', { name: '생성' }));
    expect(screen.getByRole('alert')).toHaveTextContent('같은 이름');
    expect(
      screen.getByRole('dialog', { name: '새 폴더 만들기' }),
    ).toBeVisible();
  });

  it('moves a file when it is dropped on another folder', () => {
    const onMove = vi.fn(async () => true);
    render(
      <WorkspaceExplorer
        entries={entries}
        onOpen={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn(async () => true)}
        onDelete={vi.fn()}
        onMove={onMove}
      />,
    );

    const source = screen.getByRole('button', { name: 'docs/note.md' });
    const target = screen.getByRole('button', { name: 'archive' });
    const sourceRow = source.closest('.workspace-tree__row');
    const targetRow = target.closest('.workspace-tree__row');
    if (!sourceRow || !targetRow) throw new Error('Explorer rows not found.');

    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(() => 'docs/note.md'),
    };
    fireEvent.dragStart(sourceRow, { dataTransfer });
    fireEvent.dragOver(targetRow, { dataTransfer });
    expect(targetRow).toHaveClass('workspace-tree__row--drop-target');
    fireEvent.drop(targetRow, { dataTransfer });

    expect(onMove).toHaveBeenCalledWith('docs/note.md', 'archive');
  });

  it('moves a nested file to the workspace root drop zone', () => {
    const onMove = vi.fn(async () => true);
    render(
      <WorkspaceExplorer
        entries={entries}
        onOpen={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn(async () => true)}
        onDelete={vi.fn()}
        onMove={onMove}
      />,
    );

    const source = screen.getByRole('button', { name: 'docs/note.md' });
    const sourceRow = source.closest('.workspace-tree__row');
    const rootDropzone =
      screen.getByLabelText('워크스페이스 최상위 폴더로 이동');
    if (!sourceRow) throw new Error('Explorer source row not found.');

    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(() => 'docs/note.md'),
    };
    fireEvent.dragStart(sourceRow, { dataTransfer });
    fireEvent.dragOver(rootDropzone, { dataTransfer });
    fireEvent.drop(rootDropzone, { dataTransfer });

    expect(onMove).toHaveBeenCalledWith('docs/note.md', '');
  });
});
