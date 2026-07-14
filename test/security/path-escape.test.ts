import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, symlink, mkdir, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { resolveInside } from '../../dist/util/paths.js';
import { PathEscapeError } from '../../dist/util/errors.js';

const isWindows = os.platform() === 'win32';

async function makeRepo() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'malon-escape-'));
  await writeFile(path.join(root, 'safe.txt'), 'ok');
  return root;
}

test('rejects parent directory traversal', async () => {
  const root = await makeRepo();
  try {
    await assert.rejects(
      () => resolveInside(root, '../etc/passwd'),
      PathEscapeError,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects double-dot in middle of path', async () => {
  const root = await makeRepo();
  try {
    await assert.rejects(
      () => resolveInside(root, 'src/../../etc/passwd'),
      PathEscapeError,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects absolute path outside root', async () => {
  const root = await makeRepo();
  try {
    await assert.rejects(
      () => resolveInside(root, '/etc/passwd'),
      PathEscapeError,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects symlink that resolves outside root', { skip: isWindows ? 'requires elevated privileges on Windows' : false }, async () => {
  const root = await makeRepo();
  const target = path.join(root, 'link-to-etc');
  try {
    await symlink('/etc/passwd', target);
    await assert.rejects(
      () => resolveInside(root, 'link-to-etc'),
      PathEscapeError,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects symlink inside repo resolving outside via nested dir', { skip: isWindows ? 'requires elevated privileges on Windows' : false }, async () => {
  const root = await makeRepo();
  const innerDir = path.join(root, 'inner');
  const linkDir = path.join(innerDir, 'escape-link');
  try {
    await mkdir(innerDir);
    await symlink('/etc', linkDir);
    await assert.rejects(
      () => resolveInside(root, 'inner/escape-link/passwd'),
      PathEscapeError,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('allows paths legitimately inside the repo', async () => {
  const root = await makeRepo();
  try {
    const subdir = path.join(root, 'src');
    await mkdir(subdir);
    const file = path.join(subdir, 'a.txt');
    await writeFile(file, 'ok');
    const resolved = await resolveInside(root, 'src/a.txt');
    const expected = await realpath(file);
    assert.equal(resolved, expected);
  } finally {
    await rm(root, { recursive: true, force: true }); 
  }
});

test('allows repo root itself', async () => {
  const root = await makeRepo();
  try {
    const resolved = await resolveInside(root, '.');
    const expected = await realpath(root);
    assert.equal(resolved, expected);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
