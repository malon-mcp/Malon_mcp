import { logger } from '../util/log.js';
import type { SearchSpan } from '../types.js';
import { getDb } from '../index/index.js';
import { ftsGrep } from './tools/grep.js';
import { graphWalk } from './tools/graph-walk.js';

export interface SubagentConfig {
  model: string;
  maxRounds: number;
  timeoutMs: number;
  maxOutputBytes: number;
}

export interface SubagentResult {
  spans: SearchSpan[];
  not_found: boolean;
  roundsUsed: number;
}

export async function searchSubagent(
  query: string,
  config: SubagentConfig,
): Promise<SubagentResult> {
  const startTime = Date.now();
  const db = getDb();

  const results = ftsGrep(db, query, 10);
  if (results.length === 0) {
    return { spans: [], not_found: true, roundsUsed: 1 };
  }

  const spans: SearchSpan[] = [];
  for (const r of results.slice(0, config.maxRounds)) {
    const trimmed = r.snippet.replace(/<[^>]*>/g, '').trim();
    spans.push({
      file_path: r.file_path,
      start_line: 1,
      end_line: 1,
      justification: trimmed.length > 200 ? trimmed.slice(0, 197) + '…' : trimmed,
    });
  }

  const elapsed = Date.now() - startTime;
  logger.debug({ elapsedMs: elapsed, hits: results.length }, 'subagent_complete');
  return { spans, not_found: false, roundsUsed: 1 };
}
