import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

test('createCheckpoint writes a session file', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'malon-rot-cp-'));
  await mkdir(path.join(root, '.malon', 'memory', 'sessions'), { recursive: true });

  try {
    const { createCheckpoint, resetRotState } = await import('../../../dist/governor/rot.js');
    resetRotState();

    const result = await createCheckpoint(root, 'context_size', 50000);
    assert.ok(result !== null);
    assert.ok(result.includes('memory') && result.includes('sessions'));

    const content = await readFile(result!, 'utf8');
    assert.ok(content.includes('context_size'));
    assert.ok(content.includes('50000'));

    const cooldown = await createCheckpoint(root, 'file_thrashing', 50000);
    assert.equal(cooldown, null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('createCheckpoint cools down between calls', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'malon-rot-cp2-'));
  await mkdir(path.join(root, '.malon', 'memory', 'sessions'), { recursive: true });

  try {
    const { createCheckpoint, resetRotState } = await import('../../../dist/governor/rot.js');
    resetRotState();

    await createCheckpoint(root, 'context_size', 50000);
    const second = await createCheckpoint(root, 'file_thrashing', 60000);
    assert.equal(second, null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
