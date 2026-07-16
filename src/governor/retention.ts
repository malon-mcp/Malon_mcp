import fs from 'node:fs/promises';
import path from 'node:path';
import { MalonError } from '../types.js';
import { logger } from '../util/log.js';

export interface RetentionConfig {
  usage_log_max_age_days: number;
  usage_log_max_size_mb: number;
  auto_prune_on_start: boolean;
}

const DEFAULT_RETENTION: RetentionConfig = {
  usage_log_max_age_days: 30,
  usage_log_max_size_mb: 100,
  auto_prune_on_start: true,
};

const cachedConfig: RetentionConfig = { ...DEFAULT_RETENTION };

interface RetentionConfigPartial {
  usage_log_max_age_days?: number;
  usage_log_max_size_mb?: number;
  auto_prune_on_start?: boolean;
}

export function setRetentionConfig(cfg: RetentionConfigPartial): void {
  if (cfg.usage_log_max_age_days !== undefined) {
    cachedConfig.usage_log_max_age_days = cfg.usage_log_max_age_days;
  }
  if (cfg.usage_log_max_size_mb !== undefined) {
    cachedConfig.usage_log_max_size_mb = cfg.usage_log_max_size_mb;
  }
  if (cfg.auto_prune_on_start !== undefined) {
    cachedConfig.auto_prune_on_start = cfg.auto_prune_on_start;
  }
  logger.debug({ retention: cachedConfig }, 'retention_config_set');
}

export function getRetentionConfig(): RetentionConfig {
  return { ...cachedConfig };
}

export async function pruneUsageLog(repoRoot: string): Promise<{ deleted: number; kept: number }> {
  const logPath = path.join(repoRoot, '.malon', 'usage.log');
  try {
    await fs.access(logPath);
  } catch {
    logger.debug({}, 'usage_log_not_found_skipping_prune');
    return { deleted: 0, kept: 0 };
  }

  const maxAgeMs = cachedConfig.usage_log_max_age_days * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - maxAgeMs;

  const content = await fs.readFile(logPath, 'utf8');
  const lines = content.split('\n').filter((l) => l.trim().length > 0);

  const kept: string[] = [];
  let deleted = 0;

  for (const line of lines) {
    try {
      const record = JSON.parse(line);
      const ts = record.timestamp;
      if (ts && new Date(ts).getTime() >= cutoff) {
        kept.push(line);
      } else {
        deleted++;
      }
    } catch {
      kept.push(line);
    }
  }

  await fs.writeFile(logPath, kept.join('\n') + (kept.length > 0 ? '\n' : ''), 'utf8');
  logger.info({ deleted, kept: kept.length }, 'usage_log_pruned');

  return { deleted, kept: kept.length };
}

export async function purgeUsageLog(repoRoot: string): Promise<void> {
  const logPath = path.join(repoRoot, '.malon', 'usage.log');
  try {
    await fs.writeFile(logPath, '', 'utf8');
    logger.info({}, 'usage_log_purged');
  } catch (err) {
    throw new MalonError(
      'internal',
      `Failed to purge usage.log: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function purgeIndex(repoRoot: string): Promise<void> {
  const dbPath = path.join(repoRoot, '.malon', 'index.db');
  try {
    await fs.unlink(dbPath);
    for (const ext of ['-shm', '-wal']) {
      try {
        await fs.unlink(dbPath + ext);
      } catch {}
    }
    logger.info({}, 'index_db_purged');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.debug({}, 'index_db_not_found_skipping_purge');
      return;
    }
    throw new MalonError(
      'internal',
      `Failed to purge index.db: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function purgeAllData(repoRoot: string): Promise<{
  usage_log: boolean;
  index_db: boolean;
}> {
  await purgeUsageLog(repoRoot);
  await purgeIndex(repoRoot);
  return { usage_log: true, index_db: true };
}

export async function getUsageLogStats(repoRoot: string): Promise<{
  size_bytes: number;
  record_count: number;
  oldest_record: string | null;
  newest_record: string | null;
}> {
  const logPath = path.join(repoRoot, '.malon', 'usage.log');
  try {
    const stat = await fs.stat(logPath);
    const content = await fs.readFile(logPath, 'utf8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);

    let oldest: string | null = null;
    let newest: string | null = null;

    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        const ts = record.timestamp;
        if (ts) {
          if (!oldest || ts < oldest) oldest = ts;
          if (!newest || ts > newest) newest = ts;
        }
      } catch {}
    }

    return {
      size_bytes: stat.size,
      record_count: lines.length,
      oldest_record: oldest,
      newest_record: newest,
    };
  } catch {
    return { size_bytes: 0, record_count: 0, oldest_record: null, newest_record: null };
  }
}
