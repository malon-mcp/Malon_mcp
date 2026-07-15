import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { reindexMemoryFts5 } from '../../../src/memory/ledger.js';

async function makeRepoWithMemory() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'malon-mem-fts5-'));
  await mkdir(path.join(root, '.malon', 'memory', 'sessions'), { recursive: true });
  return root;
}

test('reindexMemoryFts5 indexes memory files into FTS5', async () => {
  const root = await makeRepoWithMemory();
  const dbPath = path.join(root, '.malon', 'test-index.db');
  const db = new Database(dbPath);
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
      file_path UNINDEXED, body, tokenize = 'porter unicode61'
    )
  `);

  try {
    await writeFile(
      path.join(root, '.malon', 'memory', 'decisions.md'),
      '## Use tree-sitter for parsing\nWe chose tree-sitter over regex.',
    );
    await writeFile(
      path.join(root, '.malon', 'memory', 'conventions.md'),
      '## Import ordering\nBuilt-ins first, then external.',
    );

    await reindexMemoryFts5(root, db);

    const rows = db.prepare('SELECT file_path, body FROM content_fts WHERE file_path LIKE ?').all('.malon/memory/%') as Array<{ file_path: string; body: string }>;

    assert.equal(rows.length, 2);

    const decisions = rows.find((r) => r.file_path.includes('decisions'));
    assert.ok(decisions);
    assert.ok(decisions.body.includes('tree-sitter'));

    const conventions = rows.find((r) => r.file_path.includes('conventions'));
    assert.ok(conventions);
    assert.ok(conventions.body.includes('Import ordering'));
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('reindexMemoryFts5 indexes session files', async () => {
  const root = await makeRepoWithMemory();
  const dbPath = path.join(root, '.malon', 'test-index.db');
  const db = new Database(dbPath);
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
      file_path UNINDEXED, body, tokenize = 'porter unicode61'
    )
  `);

  try {
    await writeFile(
      path.join(root, '.malon', 'memory', 'sessions', '2026-07-15-auth.md'),
      '## Session: JWT refactor\nCompleted auth rewrite.',
    );

    await reindexMemoryFts5(root, db);

    const rows = db.prepare('SELECT file_path FROM content_fts WHERE content_fts MATCH ?').all('JWT') as Array<{ file_path: string }>;

    assert.ok(rows.length > 0);
    assert.ok(rows[0]!.file_path.includes('.malon/memory/sessions'));
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('reindexMemoryFts5 replaces old index entries', async () => {
  const root = await makeRepoWithMemory();
  const dbPath = path.join(root, '.malon', 'test-index.db');
  const db = new Database(dbPath);
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
      file_path UNINDEXED, body, tokenize = 'porter unicode61'
    )
  `);

  try {
    db.prepare('INSERT INTO content_fts (file_path, body) VALUES (?, ?)').run('.malon/memory/decisions.md', 'stale content');

    await writeFile(
      path.join(root, '.malon', 'memory', 'decisions.md'),
      '## Fresh content\nUpdated decision.',
    );

    await reindexMemoryFts5(root, db);

    const row = db.prepare('SELECT body FROM content_fts WHERE file_path = ?').get('.malon/memory/decisions.md') as { body: string } | undefined;
    assert.ok(row);
    assert.equal(row!.body.includes('stale'), false);
    assert.ok(row!.body.includes('Fresh'));
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('reindexMemoryFts5 handles empty memory directory', async () => {
  const root = await makeRepoWithMemory();
  const dbPath = path.join(root, '.malon', 'test-index.db');
  const db = new Database(dbPath);
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
      file_path UNINDEXED, body, tokenize = 'porter unicode61'
    )
  `);

  try {
    await reindexMemoryFts5(root, db);
    const rows = db.prepare('SELECT count(*) as cnt FROM content_fts WHERE file_path LIKE ?').get('.malon/memory/%') as { cnt: number };
    assert.equal(rows.cnt, 0);
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});
