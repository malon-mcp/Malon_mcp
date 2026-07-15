import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

async function makeRepoWithMemory() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'malon-mem-unit-'));
  await mkdir(path.join(root, '.malon', 'memory', 'sessions'), { recursive: true });
  return root;
}

test('getMemorySummary returns summary string when memory exists', async () => {
  const root = await makeRepoWithMemory();
  try {
    const { writeMemory, getMemorySummary } = await import('../../../dist/memory/ledger.js');
    await writeMemory(root, 'decisions', 'Use SQLite', 'Decision body');
    await writeMemory(root, 'conventions', 'Naming Pattern', 'Use camelCase');

    const summary = await getMemorySummary(root);
    assert.ok(summary.includes('Memory'));
    assert.ok(summary.length > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('getMemorySummary returns fallback when no memory', async () => {
  const root = await makeRepoWithMemory();
  try {
    const { getMemorySummary } = await import('../../../dist/memory/ledger.js');
    const summary = await getMemorySummary(root);
    assert.ok(summary.includes('No memory entries'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('getMemory with query filters results', async () => {
  const root = await makeRepoWithMemory();
  try {
    const { writeMemory, getMemory } = await import('../../../dist/memory/ledger.js');
    await writeMemory(root, 'decisions', 'SQLite Database', 'Use SQLite for storage');
    await writeMemory(root, 'conventions', 'Naming Conventions', 'Use camelCase naming');

    const filtered = await getMemory(root, 'SQLite');
    assert.ok(filtered.includes('SQLite'));
    assert.ok(!filtered.includes('camelCase') || !filtered.includes('Naming'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
