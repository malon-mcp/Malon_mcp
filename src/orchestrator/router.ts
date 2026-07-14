import crypto from 'node:crypto';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type Database from 'better-sqlite3';
import { MalonError, type SearchSpan, type StatusResult } from '../types.js';
import { logger } from '../util/log.js';
import { searchSubagent } from '../search/subagent.js';
import { getMemory, writeMemory } from '../memory/ledger.js';
import { statusCommand, setStatusSessionId } from '../cli/status.js';
import { checkRateLimit, recordTokensForRateLimit } from '../governor/rate-limiter.js';
import { computeTokensSaved, recordUsage } from '../governor/token-accounting.js';

let sessionId = crypto.randomUUID();

type ToolHandler = (input: Record<string, unknown>) => Promise<CallToolResult>;

let repoRoot = '';
let db: Database.Database | null = null;

const SUBAGENT_DEFAULTS = {
  model: 'claude-haiku-4-5',
  maxRounds: 4,
  timeoutMs: 8_000,
  maxOutputBytes: 32_768,
};

export function initRouter(root: string, database: Database.Database): void {
  repoRoot = root;
  db = database;
  setStatusSessionId(sessionId);
}

function getRepoRoot(): string {
  if (!repoRoot) throw new MalonError('config', 'Router not initialized. Call initRouter() first.');
  return repoRoot;
}

function getDb(): Database.Database {
  if (!db) throw new MalonError('config', 'Router not initialized. Call initRouter() first.');
  return db;
}

const HANDLERS: Record<string, ToolHandler> = {
  malon_search: async (input) => {
    const query = input['query'] as string | undefined;
    if (!query) {
      return { isError: true, content: [{ type: 'text', text: 'query is required' }] };
    }
    try {
      checkRateLimit(200);
    } catch (err) {
      if (err instanceof MalonError) {
        return { isError: true, content: [{ type: 'text', text: err.toUserString() }] };
      }
      throw err;
    }
    const startTime = Date.now();
    const result = await searchSubagent(query, SUBAGENT_DEFAULTS);
    recordTokensForRateLimit(200);

    const resultJson = JSON.stringify(result);
    const actualInputTokens = Math.ceil(resultJson.length / 4);
    const shadowInputTokens = Math.max(result.spans.length, 1) * 4000;
    const tokensSaved = computeTokensSaved(actualInputTokens, shadowInputTokens);
    const queryHash = crypto.createHash('sha256').update(query).digest('hex');
    recordUsage({
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      provider: SUBAGENT_DEFAULTS.model,
      model: SUBAGENT_DEFAULTS.model,
      query,
      query_hash: queryHash,
      input_tokens: actualInputTokens,
      output_tokens: 0,
      estimated_cost_usd: 0,
      round: result.roundsUsed,
      latency_ms: Date.now() - startTime,
    });
    logger.debug({ tokensSaved, actualInputTokens, shadowInputTokens }, 'tokens_saved_computed');
    return { content: [{ type: 'text', text: resultJson }] };
  },

  malon_memory_get: async (input) => {
    const query = (input['query'] as string) ?? '';
    const memory = await getMemory(getRepoRoot());
    return { content: [{ type: 'text', text: memory }] };
  },

  malon_memory_write: async (input) => {
    const category = input['category'] as string | undefined;
    const heading = input['heading'] as string | undefined;
    const body = input['body'] as string | undefined;
    if (!category || !heading || !body) {
      return { isError: true, content: [{ type: 'text', text: 'category, heading, and body are required' }] };
    }
    try {
      const writtenPath = await writeMemory(getRepoRoot(), category, heading, body);
      return { content: [{ type: 'text', text: JSON.stringify({ written: true, path: writtenPath }) }] };
    } catch (err) {
      if (err instanceof MalonError) {
        return { isError: true, content: [{ type: 'text', text: JSON.stringify({ written: false, reason: err.message }) }] };
      }
      throw err;
    }
  },

  malon_status: async () => {
    const stats = await statusCommand(getRepoRoot());
    return { content: [{ type: 'text', text: JSON.stringify(stats) }] };
  },
};

export async function route(name: string, input: Record<string, unknown>): Promise<CallToolResult> {
  const handler = HANDLERS[name];
  if (!handler) {
    return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  }
  try {
    return await handler(input);
  } catch (err) {
    if (err instanceof MalonError) {
      logger.warn({ kind: err.kind, msg: err.message }, 'tool_error');
      return { isError: true, content: [{ type: 'text', text: err.toUserString() }] };
    }
    logger.error({ err }, 'tool_internal_error');
    return {
      isError: true,
      content: [{
        type: 'text',
        text: 'Internal error. A session ID is in the server logs; please report this to the maintainer.',
      }],
    };
  }
}
