import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { safeRead, resolveInside } from '../../../src/util/paths.js';

async function makeRepo() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'malon-paths-'));
  await mkdir(path.join(root, 'nested'), { recursive: true });
  await writeFile(path.join(root, 'nested', 'file.txt'), 'hello');
  return root;
}

test('safeRead reads file inside repo', async () => {
  const root = await makeRepo();
  try {
    const content = await safeRead(root, 'nested/file.txt');
    assert.equal(content, 'hello');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('resolveInside returns correct path', async () => {
  const root = await makeRepo();
  try {
    const resolved = await resolveInside(root, 'nested/file.txt');
    const expected = await realpath(path.join(root, 'nested', 'file.txt'));
    assert.equal(resolved, expected);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('resolveInside with absolute path inside repo', async () => {
  const root = await makeRepo();
  try {
    const abs = path.join(root, 'nested/file.txt');
    const resolved = await resolveInside(root, abs);
    const expected = await realpath(abs);
    assert.equal(resolved, expected);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
