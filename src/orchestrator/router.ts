import crypto from 'node:crypto';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type Database from 'better-sqlite3';
import { MalonError, type SearchSpan, type StatusResult } from '../types.js';
import { logger } from '../util/log.js';
import { searchSubagent } from '../search/subagent.js';
import { getMemory, writeMemory, getMemorySummary } from '../memory/ledger.js';
import { statusCommand, setStatusSessionId } from '../cli/status.js';
import { checkRateLimit, recordTokensForRateLimit } from '../governor/rate-limiter.js';
import { computeTokensSaved, recordUsage, getSessionStats } from '../governor/token-accounting.js';
import { checkRot, recordFileRead, createCheckpoint } from '../governor/rot.js';

let sessionId = crypto.randomUUID();

type ToolHandler = (input: Record<string, unknown>) => Promise<CallToolResult>;

let repoRoot = '';
let db: Database.Database | null = null;
let memoryContext = '';
let autoInjectSent = false;

const SUBAGENT_DEFAULTS = {
  provider: 'anthropic',
  model: 'claude-haiku-4-5',
  maxRounds: 4,
  timeoutMs: 8_000,
  maxOutputBytes: 32_768,
};

export function initRouter(root: string, database: Database.Database): void {
  repoRoot = root;
  db = database;
  setStatusSessionId(sessionId);
  getMemorySummary(root).then((s) => {
    memoryContext = s;
    logger.debug({ memoryLen: s.length }, 'memory_auto_injected');
  }).catch(() => {});
}

const PRICING_TABLE: Record<string, Record<string, { inputPerMillion: number; outputPerMillion: number }>> = {
  anthropic: {
    'claude-haiku-4-5': { inputPerMillion: 1.00, outputPerMillion: 5.00 },
    'claude-sonnet-4-5': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  },
  openai: {
    'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.60 },
  },
  ollama: {
    'llama3.1-8b': { inputPerMillion: 0, outputPerMillion: 0 },
  },
};

function estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
  const providerPricing = PRICING_TABLE[provider];
  if (!providerPricing) return 0;
  const pricing = providerPricing[model];
  if (!pricing) return 0;
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return inputCost + outputCost;
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
    recordTokensForRateLimit(result.inputTokens + result.outputTokens);

    const resultJson = JSON.stringify(result);
    const shadowInputTokens = Math.max(result.spans.length, 1) * 4000;
    const tokensSaved = computeTokensSaved(result.inputTokens, shadowInputTokens);
    const queryHash = crypto.createHash('sha256').update(query).digest('hex');
    const estimatedCost = estimateCost(SUBAGENT_DEFAULTS.provider, SUBAGENT_DEFAULTS.model, result.inputTokens, result.outputTokens);
    recordUsage({
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      provider: SUBAGENT_DEFAULTS.provider,
      model: SUBAGENT_DEFAULTS.model,
      query,
      query_hash: queryHash,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      estimated_cost_usd: estimatedCost,
      round: result.roundsUsed,
      latency_ms: Date.now() - startTime,
    });
    for (const span of result.spans) {
      recordFileRead(span.file_path);
    }
    const stats = getSessionStats();
    const rotFlag = checkRot(stats.tokens_used);
    if (rotFlag) {
      await createCheckpoint(getRepoRoot(), rotFlag, stats.tokens_used);
    }

    const envelope: Record<string, unknown> = { ...result, rot_flag: rotFlag };
    if (!autoInjectSent && memoryContext && memoryContext !== 'No memory entries yet.') {
      envelope['memory_summary'] = memoryContext;
      autoInjectSent = true;
    }
    logger.debug({ tokensSaved, inputTokens: result.inputTokens, outputTokens: result.outputTokens, estimatedCost, rotFlag }, 'tokens_saved_computed');
    return { content: [{ type: 'text', text: JSON.stringify(envelope) }] };
  },

  malon_memory_get: async (input) => {
    const query = (input['query'] as string) ?? '';
    const memory = await getMemory(getRepoRoot(), query || undefined);
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

    let checkpointPath: string | null = null;
    if (stats.rot_flag) {
      checkpointPath = await createCheckpoint(getRepoRoot(), stats.rot_flag, stats.tokens_used);
    }

    const memorySummary = await getMemorySummary(getRepoRoot());
    return { content: [{ type: 'text', text: JSON.stringify({ ...stats, memory_summary: memorySummary, checkpoint: checkpointPath }) }] };
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
