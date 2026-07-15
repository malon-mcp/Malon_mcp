import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { getSessionStats } from '../governor/token-accounting.js';
import { checkRot } from '../governor/rot.js';
import { logger } from '../util/log.js';
import type { StatusResult } from '../types.js';

const startTime = Date.now();
let currentSessionId = '';

export function setStatusSessionId(id: string): void {
  currentSessionId = id;
}

export function getUptimeMs(): number {
  return Date.now() - startTime;
}

function readIndexSha(repoRoot: string): string {
  const dbPath = path.join(repoRoot, '.malon', 'index.db');
  try {
    if (fs.existsSync(dbPath)) {
      const db = new Database(dbPath, { readonly: true });
      const row = db
        .prepare("SELECT value FROM index_meta WHERE key = 'last_indexed_sha'")
        .get() as { value: string } | undefined;
      db.close();
      return row?.value ?? '';
    }
  } catch {
    // Index DB not available
  }
  return '';
}

export async function statusCommand(repoRoot?: string): Promise<StatusResult> {
  const stats = getSessionStats();
  const rotFlag = checkRot(stats.tokens_used);

  const result: StatusResult = {
    session_id: currentSessionId,
    spend_usd: stats.spend_usd,
    tokens_used: stats.tokens_used,
    tokens_saved_cumulative: stats.tokens_saved_cumulative,
    rot_flag: rotFlag,
    last_index_sha: repoRoot ? readIndexSha(repoRoot) : '',
    uptime_ms: Date.now() - startTime,
  };

  logger.debug({ ...result }, 'status');
  return result;
}
