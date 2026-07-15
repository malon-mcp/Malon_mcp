import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

let tempDir = '';

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'malon-empty-repo-'));
});

after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test('indexRepo handles empty directory gracefully', async () => {
  const { initIndex, indexRepo, closeDb } = await import('../../../src/index/index.js');
  const dbPath = path.join(tempDir, '.malon', 'empty-index.db');
  await mkdir(path.dirname(dbPath), { recursive: true });

  initIndex(dbPath, tempDir);
  const result = await indexRepo(tempDir);

  assert.equal(typeof result.files_indexed, 'number');
  assert.equal(typeof result.files_skipped, 'number');
  assert.equal(result.files_indexed, 0);

  closeDb();
});

test('indexRepo handles directory with only unsupported file types', async () => {
  const { initIndex, indexRepo, closeDb } = await import('../../../src/index/index.js');
  const dbPath = path.join(tempDir, '.malon', 'bin-index.db');
  const { writeFile } = await import('node:fs/promises');

  await mkdir(path.join(tempDir, 'bin'), { recursive: true });
  await writeFile(path.join(tempDir, 'bin', 'data.bin'), Buffer.alloc(100));
  await writeFile(path.join(tempDir, 'readme.md'), '# Readme');

  initIndex(dbPath, tempDir);
  const result = await indexRepo(tempDir);

  assert.equal(result.files_indexed, 0);
  assert.ok(result.files_skipped >= 0);

  closeDb();
});

test('initIndex creates valid db with expected tables', async () => {
  const { initIndex, closeDb, getDb } = await import('../../../src/index/index.js');
  const dbPath = path.join(tempDir, '.malon', 'schema-index.db');
  await mkdir(path.dirname(dbPath), { recursive: true });

  initIndex(dbPath, tempDir);
  const db = getDb();

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
    name: string;
  }[];
  const tableNames = tables.map((t) => t.name);

  assert.ok(tableNames.includes('files'), 'files table should exist');
  assert.ok(tableNames.includes('symbols'), 'symbols table should exist');
  assert.ok(tableNames.includes('edges'), 'edges table should exist');
  assert.ok(tableNames.includes('index_meta'), 'index_meta table should exist');
  assert.ok(tableNames.includes('schema_version'), 'schema_version table should exist');
  assert.ok(tableNames.includes('content_fts'), 'content_fts table should exist');

  closeDb();
});
