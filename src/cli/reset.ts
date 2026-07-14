import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../util/log.js';

export async function resetCommand(repoRoot: string): Promise<void> {
  const indexDb = path.join(repoRoot, '.malon', 'index.db');
  const usageLog = path.join(repoRoot, '.malon', 'usage.log');
  const lockFile = path.join(repoRoot, '.malon', '.malon.lock');

  for (const file of [indexDb, usageLog, lockFile]) {
    try {
      await fs.unlink(file);
      logger.info({ path: file }, 'deleted');
    } catch {
      // File doesn't exist
    }
  }

  logger.info({}, 'reset_complete');
}
