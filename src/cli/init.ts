import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../util/log.js';
import { initIndex, indexRepo, closeDb, getDb } from '../index/index.js';
import { incrementalIndex } from '../index/incremental.js';
import { recordUsage } from '../governor/token-accounting.js';

const execFileP = promisify(execFile);

const MINIMAL_ENV: NodeJS.ProcessEnv = {
  PATH: process.env['PATH'] ?? '',
};

async function gitRoot(repoRoot: string): Promise<string | null> {
  try {
    const { stdout } = await execFileP('git', ['rev-parse', '--git-dir'], {
      cwd: repoRoot,
      timeout: 5000,
      maxBuffer: 1024 * 1024,
      env: MINIMAL_ENV,
    });
    const gitDir = stdout.trim();
    return path.resolve(repoRoot, gitDir);
  } catch {
    return null;
  }
}

async function installGitHooks(repoRoot: string): Promise<void> {
  const gitDir = await gitRoot(repoRoot);
  if (!gitDir) {
    logger.info({}, 'hook_no_git_repo');
    return;
  }

  const hooksDir = path.join(gitDir, 'hooks');
  const hookPath = path.join(hooksDir, 'post-commit');

  try {
    await fs.access(hookPath);
    const existing = await fs.readFile(hookPath, 'utf8');
    if (existing.includes('malon init --incremental')) {
      logger.info({ path: hookPath }, 'hook_already_installed');
      return;
    }
  } catch {
    // File doesn't exist, will create
  }

  const cliPath = fileURLToPath(import.meta.resolve('../cli/index.js'));
  const hookScript = `#!/bin/sh
# Malon: auto-reindex on every commit
exec node "${cliPath}" init --incremental
`;

  try {
    await fs.writeFile(hookPath, hookScript, { mode: 0o755 });
    logger.info({ path: hookPath }, 'hook_installed');
  } catch (err) {
    logger.warn({ err, path: hookPath }, 'hook_install_failed');
  }
}

const DEFAULT_CONFIG = `# Malon configuration
pricing:
  last_verified: '2026-07-14'
  providers:
    anthropic:
      claude-haiku-4-5:
        input_per_million: 1.00
        output_per_million: 5.00
    openai:
      gpt-4o-mini:
        input_per_million: 0.15
        output_per_million: 0.60
    ollama:
      llama3.1-8b:
        input_per_million: 0
        output_per_million: 0

search:
  provider: anthropic
  model: claude-haiku-4-5
  subagent_timeout_ms: 8000
  max_rounds: 4
  max_output_bytes: 32768

cost:
  ceiling_usd: 0
  shadow:
    tokens_per_file_read: 4000
    avg_tokens_per_file: 350

rate_limits:
  max_calls_per_session: 100
  max_tokens_per_session: 500000
  window_ms: 60000

log:
  level: info
  file: ''

telemetry:
  enabled: false
`;

export async function initCommand(
  repoRoot: string,
  options?: { incremental?: boolean },
): Promise<void> {
  const malonDir = path.join(repoRoot, '.malon');
  const configPath = path.join(malonDir, 'config.yml');
  const dbPath = path.join(malonDir, 'index.db');

  await fs.mkdir(path.join(malonDir, 'memory', 'sessions'), { recursive: true });

  try {
    await fs.access(configPath);
    logger.info({ path: configPath }, 'config_exists');
  } catch {
    await fs.writeFile(configPath, DEFAULT_CONFIG, 'utf8');
    logger.info({ path: configPath }, 'config_created');
  }

  await installGitHooks(repoRoot);

  initIndex(dbPath, repoRoot);
  recordUsage({
    timestamp: new Date().toISOString(),
    session_id: 'init',
    provider: 'local',
    model: 'indexer',
    query: 'init',
    query_hash: '',
    input_tokens: 0,
    output_tokens: 0,
    estimated_cost_usd: 0,
    round: 0,
    latency_ms: 0,
  });

  let filesIndexed: number;
  let filesSkipped: number;

  if (options?.incremental) {
    const result = await incrementalIndex(repoRoot);
    filesIndexed = result.files_indexed;
    filesSkipped = result.files_removed;
    logger.info({ filesIndexed, filesRemoved: filesSkipped }, 'init_incremental_complete');
  } else {
    const result = await indexRepo(repoRoot);
    filesIndexed = result.files_indexed;
    filesSkipped = result.files_skipped;
    logger.info({ filesIndexed, filesSkipped }, 'init_index_complete');
  }

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
    logger.info({ sha: headSha }, 'init_git_sha_recorded');
  } catch {
    logger.info({}, 'init_not_a_git_repo');
  }

  closeDb();
}
