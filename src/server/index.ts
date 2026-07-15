import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { z } from 'zod/v4';
import { logger } from '../util/log.js';
import { route, initRouter } from '../orchestrator/router.js';
import { initIndex, getDb } from '../index/index.js';
import { applyConfig } from '../util/config.js';
import { startWatcher, stopWatcher } from '../index/watcher.js';
import { tryAcquireLock, releaseLock } from '../util/lock.js';

const server = new McpServer(
  {
    name: 'malon',
    version: '0.0.1',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.tool(
  'malon_search',
  'Search the indexed codebase and return the 1-3 most relevant file:line spans with a one-line justification',
  {
    query: z.string().min(1).max(512).describe('The search query'),
    max_results: z.number().int().min(1).max(5).default(3).describe('Maximum number of results'),
  },
  async (args) => {
    logger.debug({ query: args.query }, 'malon_search_called');
    const result = await route('malon_search', args as Record<string, unknown>);
    return result;
  },
);

server.tool(
  'malon_memory_get',
  'Retrieve relevant memory entries from the memory ledger',
  {
    query: z.string().min(1).max(512).describe('The memory query'),
  },
  async (args) => {
    logger.debug({ query: args.query }, 'malon_memory_get_called');
    const result = await route('malon_memory_get', args as Record<string, unknown>);
    return result;
  },
);

server.tool(
  'malon_memory_write',
  'Write a new entry to the memory ledger',
  {
    category: z
      .enum(['decisions', 'conventions', 'rejected', 'session'])
      .describe('Memory category'),
    heading: z.string().min(1).max(120).describe('Entry heading'),
    body: z.string().min(1).max(2000).describe('Entry body'),
  },
  async (args) => {
    logger.debug({ category: args.category }, 'malon_memory_write_called');
    const result = await route('malon_memory_write', args as Record<string, unknown>);
    return result;
  },
);

server.tool(
  'malon_status',
  'Returns current session status, spend, and rot flags',
  {},
  async () => {
    const result = await route('malon_status', {});
    return result;
  },
);

server.tool(
  'malon_checkpoint',
  'Explicitly trigger a rot checkpoint, saving current session progress to the memory ledger',
  {
    cause: z
      .string()
      .max(200)
      .optional()
      .describe('Optional reason for the checkpoint (e.g. "context_heavy", "switching_tasks")'),
  },
  async (args) => {
    const result = await route('malon_checkpoint', args as Record<string, unknown>);
    return result;
  },
);

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const malonDir = path.join(repoRoot, '.malon');
  const sessionId = crypto.randomUUID();

  try {
    fs.mkdirSync(path.join(malonDir, 'memory', 'sessions'), { recursive: true });
  } catch {
    // Directory already exists
  }

  const locked = tryAcquireLock(malonDir, sessionId);
  if (!locked) {
    logger.error({ dir: malonDir }, 'lock_already_held_exiting');
    process.stderr.write('error: Another Malon server is already running in this repo.\n');
    process.stderr.write(
      `try:   Stop the other process or remove ${path.join(malonDir, '.malon.lock')}\n`,
    );
    process.exit(1);
  }

  const dbPath = path.join(malonDir, 'index.db');

  try {
    initIndex(dbPath);
  } catch (err) {
    logger.warn({ err }, 'index_corrupted_reindexing');
    try {
      fs.unlinkSync(dbPath);
      initIndex(dbPath);
    } catch (reindexErr) {
      logger.error({ err: reindexErr }, 'index_reindex_failed');
      releaseLock(malonDir);
      process.exit(1);
    }
  }

  await applyConfig(repoRoot);
  initRouter(repoRoot, getDb());

  const gitDir = path.join(repoRoot, '.git');
  try {
    fs.accessSync(gitDir);
    logger.info({}, 'git_repo_detected_watcher_skipped');
  } catch {
    startWatcher(repoRoot);
  }

  function shutdown(): void {
    stopWatcher();
    releaseLock(malonDir);
    process.exit(0);
  }

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  logger.info({ version: '0.0.1', cwd: repoRoot, session_id: sessionId }, 'malon_server_start');
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  logger.error({ err }, 'malon_server_crash');
  process.exit(1);
});
