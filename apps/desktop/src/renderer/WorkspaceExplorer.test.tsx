import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceExplorer } from './WorkspaceExplorer';

const entries = [
  { relativePath: 'docs', displayName: 'docs', kind: 'directory' as const },
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
});
