import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceWatcher } from './workspace-watcher';

describe('WorkspaceWatcher', () => {
  it('notifies after a file changes and stops after disposal', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-dock-watch-'));
    const onChange = vi.fn();
    const watcher = new WorkspaceWatcher(root, onChange);
    await watcher.start();

    try {
      await fs.writeFile(path.join(root, 'external.md'), '# External', 'utf8');
      await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), {
        timeout: 2_000,
      });
      const callsBeforeDispose = onChange.mock.calls.length;
      watcher.dispose();
      await fs.writeFile(
        path.join(root, 'after-dispose.md'),
        '# Ignored',
        'utf8',
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
      expect(onChange).toHaveBeenCalledTimes(callsBeforeDispose);
    } finally {
      watcher.dispose();
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
