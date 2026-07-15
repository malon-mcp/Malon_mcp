import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

let tempDir = '';
let malonDir = '';

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'malon-lock-'));
  malonDir = path.join(tempDir, '.malon');
  await mkdir(malonDir, { recursive: true });
});

after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test('tryAcquireLock succeeds on fresh lock', async () => {
  const { tryAcquireLock, releaseLock } = await import('../../../src/util/lock.js');
  const result = tryAcquireLock(malonDir, 'test-session-1');
  assert.equal(result, true);
  releaseLock(malonDir);
});

test('releaseLock removes the lock file', async () => {
  const { tryAcquireLock, releaseLock } = await import('../../../src/util/lock.js');
  tryAcquireLock(malonDir, 'test-session-2');
  releaseLock(malonDir);
  const lockPath = path.join(malonDir, '.malon.lock');
  assert.equal(fs.existsSync(lockPath), false);
});

test('tryAcquireLock creates valid JSON lock file', async () => {
  const { tryAcquireLock, releaseLock } = await import('../../../src/util/lock.js');
  tryAcquireLock(malonDir, 'test-session-3');
  const lockPath = path.join(malonDir, '.malon.lock');
  const content = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  assert.equal(typeof content.pid, 'number');
  assert.equal(typeof content.startedAt, 'string');
  assert.equal(typeof content.sessionId, 'string');
  assert.equal(content.sessionId, 'test-session-3');
  releaseLock(malonDir);
});

test('tryAcquireLock on non-writable directory still returns true (graceful fallback)', async () => {
  const { tryAcquireLock, releaseLock } = await import('../../../src/util/lock.js');
  const result = tryAcquireLock(path.join(tempDir, 'nonexistent-deep', 'sub'), 'test');
  assert.equal(result, true);
  releaseLock(tempDir);
});

test('lock file written with correct pid', async () => {
  const { tryAcquireLock, releaseLock } = await import('../../../src/util/lock.js');
  tryAcquireLock(malonDir, 'test-session-4');
  const lockPath = path.join(malonDir, '.malon.lock');
  const content = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  assert.equal(content.pid, process.pid);
  releaseLock(malonDir);
});
