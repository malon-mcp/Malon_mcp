import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { logger } from '../util/log.js';
import { getDb, indexFile } from './index.js';
import { SUPPORTED_EXTENSIONS } from './parser.js';

const execFileP = promisify(execFile);

const MINIMAL_ENV: NodeJS.ProcessEnv = {
  PATH: process.env['PATH'] ?? '',
};

export async function incrementalIndex(
  repoRoot: string,
): Promise<{ files_indexed: number; files_removed: number }> {
  const db = getDb();

  const lastIndexedSha = db
    .prepare("SELECT value FROM index_meta WHERE key = 'last_indexed_sha'")
    .get() as { value: string } | undefined;
  const fromSha = lastIndexedSha?.value ?? '';

  if (!fromSha) {
    logger.info({}, 'incremental_no_previous_sha');
    return { files_indexed: 0, files_removed: 0 };
  }

  let headSha: string;
  try {
    const { stdout } = await execFileP('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      timeout: 5000,
      maxBuffer: 1024 * 1024,
      env: MINIMAL_ENV,
    });
    headSha = stdout.trim();
  } catch (err) {
    logger.warn({ err }, 'incremental_git_rev_parse_failed');
    return { files_indexed: 0, files_removed: 0 };
  }

  if (fromSha === headSha) {
    logger.info({ sha: headSha }, 'incremental_up_to_date');
    return { files_indexed: 0, files_removed: 0 };
  }

  let diffOutput: string;
  try {
    const { stdout } = await execFileP('git', ['diff', '--name-only', fromSha, 'HEAD'], {
      cwd: repoRoot,
      timeout: 10000,
      maxBuffer: 8 * 1024 * 1024,
      env: MINIMAL_ENV,
    });
    diffOutput = stdout.trim();
  } catch (err) {
    logger.warn({ err }, 'incremental_git_diff_failed');
    return { files_indexed: 0, files_removed: 0 };
  }

  if (!diffOutput) {
    logger.info({}, 'incremental_no_changes');
    db.prepare("UPDATE index_meta SET value = ? WHERE key = 'last_indexed_sha'").run(headSha);
    return { files_indexed: 0, files_removed: 0 };
  }

  const changedFiles = diffOutput.split('\n').filter(Boolean);
  logger.info(
    { count: changedFiles.length, fromSha, toSha: headSha },
    'incremental_changes_detected',
  );

  const supportedExtensions = SUPPORTED_EXTENSIONS;

  let filesIndexed = 0;
  let filesRemoved = 0;

  for (const relativePath of changedFiles) {
    if (relativePath.startsWith('.malon/')) continue;

    const absolutePath = path.resolve(repoRoot, relativePath);

    const ext = path.extname(relativePath).toLowerCase();
    if (!supportedExtensions.has(ext)) {
      continue;
    }

    try {
      await execFileP('git', ['show', `HEAD:${relativePath}`], {
        cwd: repoRoot,
        timeout: 5000,
        maxBuffer: 8 * 1024 * 1024,
        env: MINIMAL_ENV,
      });

      await indexFile(absolutePath);
      filesIndexed++;
    } catch {
      try {
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
        filesRemoved++;
      } catch (removeErr) {
        logger.warn({ path: relativePath, err: removeErr }, 'incremental_remove_failed');
      }
    }
  }

  db.prepare("UPDATE index_meta SET value = ? WHERE key = 'last_indexed_sha'").run(headSha);

  logger.info({ filesIndexed, filesRemoved }, 'incremental_complete');
  return { files_indexed: filesIndexed, files_removed: filesRemoved };
}
