import type Database from 'better-sqlite3';
import { sanitizeFts5Query } from '../fts5-sanitize.js';
import { logger } from '../../util/log.js';

export interface GrepResult {
  file_path: string;
  snippet: string;
}

export function ftsGrep(db: Database.Database, query: string, limit = 50): GrepResult[] {
  const sanitized = sanitizeFts5Query(query);
  const fuzzyQuery = sanitized
    .split(/\s+/)
    .map((t) => `"${t}"*`)
    .join(' ');
  const rows = db
    .prepare(
      `
    SELECT file_path, snippet(content_fts, 0, '<b>', '</b>', '…', 12) AS snippet
    FROM content_fts
    WHERE content_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `,
    )
    .all(fuzzyQuery, limit) as { file_path: string; snippet: string }[];
  logger.debug({ query: sanitized, hits: rows.length }, 'fts_grep');
  return rows.map((r) => ({ file_path: r.file_path, snippet: r.snippet ?? '' }));
}
