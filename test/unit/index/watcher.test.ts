import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWatcherActive, startWatcher, stopWatcher } from '../../../src/index/watcher.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

test('watcher lifecycle: start and stop', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'malon-watch-'));
  try {
    assert.equal(isWatcherActive(), false);

    startWatcher(dir);
    assert.equal(isWatcherActive(), true);

    stopWatcher();
    assert.equal(isWatcherActive(), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('startWatcher is idempotent', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'malon-watch-'));
  try {
    startWatcher(dir);
    startWatcher(dir);
    assert.equal(isWatcherActive(), true);
    stopWatcher();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('stopWatcher without start does not throw', () => {
  assert.doesNotThrow(() => stopWatcher());
});
