import { render, screen } from '@testing-library/react';
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
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'docs/note.md' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'readme.txt' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'docs/note.md' }));
    expect(onOpen).toHaveBeenCalledWith('docs/note.md');

    await user.click(screen.getByRole('button', { name: 'docs 폴더 접기' }));
    expect(
      screen.queryByRole('button', { name: 'docs/note.md' }),
    ).not.toBeInTheDocument();
  });
});
