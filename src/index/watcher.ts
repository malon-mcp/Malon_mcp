import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../util/log.js';
import { indexFile, removeFile } from './index.js';
import { detectLanguage, SUPPORTED_EXTENSIONS } from './parser.js';

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.malon',
  'dist',
  '.next',
  'build',
  'coverage',
  '.nyc_output',
]);
const DEBOUNCE_MS = 2_000;

interface WatcherState {
  watcher: fs.FSWatcher | null;
  timer: ReturnType<typeof setTimeout> | null;
  pending: Set<string>;
  active: boolean;
}

const state: WatcherState = {
  watcher: null,
  timer: null,
  pending: new Set(),
  active: false,
};

function shouldWatch(entryPath: string): boolean {
  const parsed = path.parse(entryPath);
  if (IGNORE_DIRS.has(parsed.dir.split(path.sep).pop() ?? '')) return false;
  if (IGNORE_DIRS.has(parsed.name)) return false;
  const ext = parsed.ext.toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

function flushPending(): void {
  if (!state.active) return;
  const files = [...state.pending];
  state.pending.clear();
  state.timer = null;

  const indexed: string[] = [];
  const removed: string[] = [];

  for (const filePath of files) {
    if (!shouldWatch(filePath)) continue;

    try {
      fs.accessSync(filePath, fs.constants.F_OK);
      const lang = detectLanguage(filePath);
      if (!lang) continue;
      indexFile(filePath)
        .then(() => indexed.push(filePath))
        .catch(() => removed.push(filePath));
    } catch {
      removeFile(filePath);
      removed.push(filePath);
    }
  }

  if (indexed.length > 0) {
    logger.info({ count: indexed.length }, 'watcher_files_indexed');
  }
  if (removed.length > 0) {
    logger.info({ count: removed.length }, 'watcher_files_removed');
  }
}

function scheduleFlush(): void {
  if (state.timer) {
    clearTimeout(state.timer);
  }
  state.timer = setTimeout(flushPending, DEBOUNCE_MS);
}

export function startWatcher(repoRoot: string): void {
  if (state.active) {
    logger.warn({}, 'watcher_already_running');
    return;
  }

  try {
    const watcher = fs.watch(repoRoot, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      const fullPath = path.resolve(repoRoot, filename.toString());
      if (!shouldWatch(fullPath)) return;
      state.pending.add(fullPath);
      scheduleFlush();
    });

    state.watcher = watcher;
    state.active = true;
    logger.info({ root: repoRoot }, 'watcher_started');
  } catch (err) {
    logger.warn({ err }, 'watcher_start_failed');
  }
}

export function stopWatcher(): void {
  if (!state.active) return;
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  if (state.watcher) {
    state.watcher.close();
    state.watcher = null;
  }
  state.pending.clear();
  state.active = false;
  logger.info({}, 'watcher_stopped');
}

export function isWatcherActive(): boolean {
  return state.active;
}
