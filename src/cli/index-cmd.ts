import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { logger } from '../util/log.js';
import { initIndex, indexRepo, closeDb, getDb } from '../index/index.js';

const execFileP = promisify(execFile);

const MINIMAL_ENV: NodeJS.ProcessEnv = {
  PATH: process.env['PATH'] ?? '',
};

export async function indexCommand(repoRoot: string): Promise<void> {
  const dbPath = path.join(repoRoot, '.malon', 'index.db');

  initIndex(dbPath, repoRoot);
  logger.info({}, 'index_command_start');

  const { files_indexed, files_skipped } = await indexRepo(repoRoot);
  logger.info(
    { filesIndexed: files_indexed, filesSkipped: files_skipped },
    'index_command_complete',
  );

  try {
    const { stdout } = await execFileP('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      timeout: 5000,
      maxBuffer: 1024 * 1024,
      env: MINIMAL_ENV,
    });
    const db = getDb();
    const headSha = stdout.trim();
    db.prepare("UPDATE index_meta SET value = ? WHERE key = 'last_indexed_sha'").run(headSha);
    logger.info({ sha: headSha }, 'index_git_sha_recorded');
  } catch {
    logger.info({}, 'index_not_a_git_repo');
  }

  closeDb();
}
