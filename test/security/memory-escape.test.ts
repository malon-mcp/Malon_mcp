import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { writeMemory, getMemory } from '../../dist/memory/ledger.js';
import { MalonError } from '../../dist/types.js';

async function makeRepoWithMemory() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'malon-memory-'));
  await mkdir(path.join(root, '.malon', 'memory', 'sessions'), { recursive: true });
  return root;
}

test('writeMemory writes inside memory directory', async () => {
  const root = await makeRepoWithMemory();
  try {
    const writtenPath = await writeMemory(root, 'decisions', 'Test Decision', 'Body text');
    const memDir = await realpath(path.join(root, '.malon', 'memory'));
    assert.ok(writtenPath.startsWith(memDir));
    const content = await readFile(writtenPath, 'utf8');
    assert.ok(content.includes('Test Decision'));
    assert.ok(content.includes('Body text'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('writeMemory rejects unknown category', async () => {
  const root = await makeRepoWithMemory();
  try {
    await assert.rejects(
      () => writeMemory(root, 'unknown', 'Heading', 'Body'),
      MalonError,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('getMemory returns readable content', async () => {
  const root = await makeRepoWithMemory();
  try {
    await writeMemory(root, 'decisions', 'First Decision', 'First body');
    const content = await getMemory(root);
    assert.ok(content.includes('First Decision'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('writeMemory resolves path inside memory directory boundary', async () => {
  const root = await makeRepoWithMemory();
  try {
    const writtenPath = await writeMemory(root, 'session', 'Test Heading', 'Test body');
    const memDir = await realpath(path.join(root, '.malon', 'memory'));
    assert.ok(writtenPath.startsWith(memDir));
    const content = await readFile(writtenPath, 'utf8');
    assert.ok(content.includes('Test Heading'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('writeMemory rejects category-based path escape via unknown category', async () => {
  const root = await makeRepoWithMemory();
  try {
    await assert.rejects(
      () => writeMemory(root, '../../../etc/passwd', 'Heading', 'Body'),
      (err: unknown) => err instanceof MalonError,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('writeMemory rejects binary injection in category', async () => {
  const root = await makeRepoWithMemory();
  try {
    await assert.rejects(
      () => writeMemory(root, 'decisions\x00\x00\x00', 'Heading', 'Body'),
      (err: unknown) => err instanceof MalonError,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
