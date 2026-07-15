import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod/v4';
import { logger } from '../util/log.js';
import { route, initRouter } from '../orchestrator/router.js';
import { initIndex, getDb } from '../index/index.js';
import { applyConfig } from '../util/config.js';
import { startWatcher, stopWatcher } from '../index/watcher.js';

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
    category: z.enum(['decisions', 'conventions', 'rejected', 'session']).describe('Memory category'),
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

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const malonDir = path.join(repoRoot, '.malon');

  try {
    fs.mkdirSync(path.join(malonDir, 'memory', 'sessions'), { recursive: true });
  } catch {
    // Directory already exists
  }

  const dbPath = path.join(malonDir, 'index.db');
  initIndex(dbPath);
  await applyConfig(repoRoot);
  initRouter(repoRoot, getDb());

  const gitDir = path.join(repoRoot, '.git');
  try {
    fs.accessSync(gitDir);
    logger.info({}, 'git_repo_detected_watcher_skipped');
  } catch {
    startWatcher(repoRoot);
  }

  process.once('SIGINT', () => {
    stopWatcher();
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    stopWatcher();
    process.exit(0);
  });

  logger.info({ version: '0.0.1', cwd: repoRoot }, 'malon_server_start');
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  logger.error({ err }, 'malon_server_crash');
  process.exit(1);
});
