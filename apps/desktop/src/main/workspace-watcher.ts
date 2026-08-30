import { watch, type FSWatcher } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { DEFAULT_IGNORED_DIRECTORIES } from './workspace-service';

type ChangeListener = () => void;

export class WorkspaceWatcher {
  private readonly watchers = new Map<string, FSWatcher>();
  private timer: NodeJS.Timeout | undefined;
  private disposed = false;

  public constructor(
    private readonly root: string,
    private readonly onChange: ChangeListener,
  ) {}

  public async start(): Promise<void> {
    await this.refreshDirectories();
  }

  private async findDirectories(current: string): Promise<string[]> {
    const directories = [current];
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return directories;
    }
    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        entry.name.startsWith('.') ||
        DEFAULT_IGNORED_DIRECTORIES.has(entry.name)
      )
        continue;
      directories.push(
        ...(await this.findDirectories(path.join(current, entry.name))),
      );
    }
    return directories;
  }

  private async refreshDirectories(): Promise<void> {
    if (this.disposed) return;
    const directories = new Set(await this.findDirectories(this.root));
    for (const [directory, watcher] of this.watchers) {
      if (!directories.has(directory)) {
        watcher.close();
        this.watchers.delete(directory);
      }
    }
    for (const directory of directories) {
      if (this.watchers.has(directory)) continue;
      try {
        const watcher = watch(directory, { persistent: false }, () => {
          this.scheduleChange();
        });
        watcher.on('error', () => {
          watcher.close();
          this.watchers.delete(directory);
          this.scheduleChange();
        });
        this.watchers.set(directory, watcher);
      } catch {
        // A directory may disappear between the scan and watcher creation.
      }
    }
  }

  private scheduleChange(): void {
    if (this.disposed || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.refreshDirectories().finally(() => {
        if (!this.disposed) this.onChange();
      });
    }, 120);
  }

  public dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    for (const watcher of this.watchers.values()) watcher.close();
    this.watchers.clear();
  }
}
