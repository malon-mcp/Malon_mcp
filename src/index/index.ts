import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { logger } from '../util/log.js';
import { initParser, parseFileContent, detectLanguage, SUPPORTED_EXTENSIONS } from './parser.js';

let db: DatabaseType | null = null;
let repoRoot = '';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  language TEXT,
  last_indexed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY,
  file_path TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  signature TEXT,
  body_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_path);

CREATE TABLE IF NOT EXISTS edges (
  from_symbol_id INTEGER REFERENCES symbols(id) ON DELETE CASCADE,
  to_symbol_name TEXT NOT NULL,
  to_file_path TEXT,
  kind TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_symbol_id);
CREATE INDEX IF NOT EXISTS idx_edges_to_name ON edges(to_symbol_name);

CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
  file_path UNINDEXED,
  body,
  tokenize = 'porter unicode61'
);

CREATE TABLE IF NOT EXISTS index_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export function initIndex(dbPath: string, root = ''): void {
  const isNew = !(db && db.open);

  if (!isNew) {
    db!.close();
  }

  db = new Database(dbPath);
  repoRoot = root;
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec(SCHEMA_SQL);

  const versionRow = db
    .prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
    .get() as { version: number } | undefined;
  if (!versionRow) {
    db.prepare('INSERT INTO schema_version (version) VALUES (1)').run();
  }

  db.prepare("INSERT OR IGNORE INTO index_meta(key, value) VALUES ('last_indexed_sha', '')").run();

  try {
    db.prepare('SELECT COUNT(*) FROM content_fts').get();
  } catch {
    logger.warn({}, 'fts5_table_corrupted_rebuilding');
    db.exec('DROP TABLE IF EXISTS content_fts');
    db.exec(
      "CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(file_path UNINDEXED, body, tokenize = 'porter unicode61')",
    );
  }

  logger.info({ path: dbPath, isNew: !db.open }, 'index_initialized');
}

export function getDb(): DatabaseType {
  if (!db || !db.open) throw new Error('Index not initialized. Call initIndex() first.');
  return db;
}

export function getRepoRoot(): string {
  return repoRoot;
}

export function closeDb(): void {
  if (!db || !db.open) return;
  db.close();
  db = null;
  repoRoot = '';
  logger.info({}, 'index_closed');
}

function contentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export async function indexFile(absolutePath: string): Promise<void> {
  if (!db || !db.open) throw new Error('Index not initialized');

  const lang = detectLanguage(absolutePath);
  if (!lang) return;

  let content: string;
  try {
    content = await fs.readFile(absolutePath, 'utf8');
  } catch (err) {
    logger.warn({ path: absolutePath, err }, 'index_file_read_failed');
    return;
  }

  const hash = contentHash(content);
  const now = new Date().toISOString();
  const insertFile = db!.prepare(`
    INSERT OR REPLACE INTO files (path, content_hash, language, last_indexed_at)
    VALUES (?, ?, ?, ?)
  `);
  insertFile.run(absolutePath, hash, lang, now);

  const result = parseFileContent(absolutePath, content);
  if (!result) return;

  const { symbols, edges } = result;

  const deleteSymbols = db!.prepare('DELETE FROM symbols WHERE file_path = ?');
  const deleteEdges = db!.prepare(
    'DELETE FROM edges WHERE from_symbol_id IN (SELECT id FROM symbols WHERE file_path = ?)',
  );
  const insertSymbol = db!.prepare(`
    INSERT INTO symbols (file_path, name, kind, start_line, end_line, signature, body_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEdge = db!.prepare(`
    INSERT INTO edges (from_symbol_id, to_symbol_name, to_file_path, kind)
    VALUES (?, ?, ?, ?)
  `);
  const deleteFts = db!.prepare('DELETE FROM content_fts WHERE file_path = ?');
  const insertFts = db!.prepare('INSERT INTO content_fts (file_path, body) VALUES (?, ?)');

  const transaction = db!.transaction(() => {
    deleteEdges.run(absolutePath);
    deleteSymbols.run(absolutePath);
    deleteFts.run(absolutePath);

    const symbolIds: number[] = [];
    for (const sym of symbols) {
      const info = insertSymbol.run(
        absolutePath,
        sym.name,
        sym.kind,
        sym.start_line,
        sym.end_line,
        sym.signature,
        sym.body_hash,
      );
      symbolIds.push(Number(info.lastInsertRowid));
    }

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      if (!edge) continue;
      insertEdge.run(symbolIds[i] ?? 1, edge.to_symbol_name, edge.to_file_path, edge.kind);
    }

    insertFts.run(absolutePath, content);
  });

  transaction();
}

export function removeFile(absolutePath: string): void {
  if (!db || !db.open) throw new Error('Index not initialized');
  const deleteSymbols = db.prepare('DELETE FROM symbols WHERE file_path = ?');
  const deleteFts = db.prepare('DELETE FROM content_fts WHERE file_path = ?');
  const deleteEdges = db.prepare(
    'DELETE FROM edges WHERE from_symbol_id IN (SELECT id FROM symbols WHERE file_path = ?)',
  );
  const deleteFile = db.prepare('DELETE FROM files WHERE path = ?');
  const transaction = db.transaction(() => {
    deleteEdges.run(absolutePath);
    deleteSymbols.run(absolutePath);
    deleteFts.run(absolutePath);
    deleteFile.run(absolutePath);
  });
  transaction();
}

export async function indexRepo(
  root: string,
): Promise<{ files_indexed: number; files_skipped: number }> {
  await initParser();

  let filesIndexed = 0;
  let filesSkipped = 0;

  const supportedExtensions = SUPPORTED_EXTENSIONS;

  const ignoreDirs = new Set([
    'node_modules',
    '.git',
    '.malon',
    'dist',
    '.next',
    'build',
    'coverage',
    '.nyc_output',
  ]);

  async function walk(dir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        if (!ignoreDirs.has(entry)) {
          await walk(fullPath);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(entry).toLowerCase();
        if (supportedExtensions.has(ext)) {
          try {
            await indexFile(fullPath);
            filesIndexed++;
          } catch {
            filesSkipped++;
          }
        } else {
          filesSkipped++;
        }
      }
    }
  }

  await walk(root);

  if (filesIndexed === 0 && filesSkipped === 0) {
    logger.warn({ root }, 'index_empty_repo_no_supported_files');
  } else if (filesIndexed === 0 && filesSkipped > 0) {
    logger.warn({ root, filesSkipped }, 'index_no_supported_files_all_skipped');
  }

  logger.info({ filesIndexed, filesSkipped }, 'index_repo_complete');
  return { files_indexed: filesIndexed, files_skipped: filesSkipped };
}
