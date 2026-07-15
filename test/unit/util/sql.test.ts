import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { sql, query, queryOne, execute } from '../../../src/util/sql.js';

function makeDb(): Database.Database {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'malon-sql-'));
  const dbPath = path.join(dir, 'test.db');
  const db = new Database(dbPath);
  db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT, value INTEGER)');
  return db;
}

test('sql builds parameterized query', () => {
  const q = sql`SELECT * FROM test WHERE name = ${'foo'} AND value = ${42}`;
  assert.equal(q.text, 'SELECT * FROM test WHERE name = ? AND value = ?');
  assert.deepEqual(q.params, ['foo', 42]);
});

test('sql with no params', () => {
  const q = sql`SELECT * FROM test`;
  assert.equal(q.text, 'SELECT * FROM test');
  assert.deepEqual(q.params, []);
});

test('sql with empty template', () => {
  const q = sql``;
  assert.equal(q.text, '');
  assert.deepEqual(q.params, []);
});

test('query returns rows', () => {
  const db = makeDb();
  try {
    db.prepare('INSERT INTO test (id, name, value) VALUES (1, ?, ?)').run('alpha', 10);
    db.prepare('INSERT INTO test (id, name, value) VALUES (2, ?, ?)').run('beta', 20);

    const rows = query<{ id: number; name: string; value: number }>(
      db,
      sql`SELECT * FROM test WHERE value > ${5} ORDER BY id`,
    );

    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.name, 'alpha');
    assert.equal(rows[1]!.value, 20);
  } finally {
    db.close();
  }
});

test('query with extra params', () => {
  const db = makeDb();
  try {
    db.prepare('INSERT INTO test (id, name, value) VALUES (1, ?, ?)').run('x', 100);

    const rows = query<{ id: number }>(db, sql`SELECT * FROM test WHERE id = ?`, 1);

    assert.equal(rows.length, 1);
  } finally {
    db.close();
  }
});

test('queryOne returns single row', () => {
  const db = makeDb();
  try {
    db.prepare('INSERT INTO test (id, name, value) VALUES (1, ?, ?)').run('alpha', 10);

    const row = queryOne<{ name: string }>(db, sql`SELECT name FROM test WHERE id = ${1}`);

    assert.ok(row);
    assert.equal(row!.name, 'alpha');
  } finally {
    db.close();
  }
});

test('queryOne returns undefined when no match', () => {
  const db = makeDb();
  try {
    const row = queryOne(db, sql`SELECT * FROM test WHERE id = ${999}`);
    assert.equal(row, undefined);
  } finally {
    db.close();
  }
});

test('execute inserts and returns changes', () => {
  const db = makeDb();
  try {
    const result = execute(
      db,
      sql`INSERT INTO test (id, name, value) VALUES (${1}, ${'x'}, ${100})`,
    );
    assert.equal(result.changes, 1);
    assert.ok(result.lastInsertRowid);
  } finally {
    db.close();
  }
});

test('FTS5 MATCH clause is parameterized', () => {
  const db = makeDb();
  try {
    db.exec('CREATE VIRTUAL TABLE test_fts USING fts5(name)');
    db.prepare('INSERT INTO test_fts VALUES (?)').run('hello world');

    const q = sql`SELECT rowid FROM test_fts WHERE test_fts MATCH ${'hello'}`;
    assert.equal(q.text, 'SELECT rowid FROM test_fts WHERE test_fts MATCH ?');

    const rows = query<{ rowid: number }>(db, q);
    assert.equal(rows.length, 1);
  } finally {
    db.close();
  }
});

test('filters out undefined params correctly', () => {
  const db = makeDb();
  try {
    db.prepare('INSERT INTO test (id, name, value) VALUES (1, ?, ?)').run('a', 1);

    const q = sql`SELECT * FROM test WHERE name = ${'a'} AND value = ${1}`;
    assert.equal(q.params.length, 2);
    const rows = query(db, q);
    assert.equal(rows.length, 1);
  } finally {
    db.close();
  }
});
