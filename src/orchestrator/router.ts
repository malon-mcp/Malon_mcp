import crypto from 'node:crypto';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type Database from 'better-sqlite3';
import { MalonError } from '../types.js';
import { logger } from '../util/log.js';
import { searchSubagent } from '../search/subagent.js';
import { getMemory, writeMemory, getMemorySummary, reindexMemoryFts5 } from '../memory/ledger.js';
import { statusCommand, setStatusSessionId } from '../cli/status.js';
import { checkRateLimit, recordTokensForRateLimit } from '../governor/rate-limiter.js';
import { computeTokensSaved, recordUsage, getSessionStats } from '../governor/token-accounting.js';
import { checkRot, recordFileRead, createCheckpoint } from '../governor/rot.js';
import { createStableItem, createDynamicItem, orderContext } from './cache-ordering.js';
import { getSearchConfig } from '../util/config.js';
import { handleAdmin } from '../auth/admin-handler.js';

const sessionId = crypto.randomUUID();

type ToolHandler = (input: Record<string, unknown>) => Promise<CallToolResult>;

let repoRoot = '';
let db: Database.Database | null = null;
let memoryContext = '';
let autoInjectSent = false;

function getSubagentConfig() {
  const cfg = getSearchConfig();
  return {
    provider: cfg.provider ?? 'gemini',
    model: cfg.model ?? 'gemini-2.0-flash',
    maxRounds: Math.max(1, Math.min(6, cfg.max_rounds ?? 4)),
    timeoutMs: cfg.subagent_timeout_ms ?? 8_000,
    maxOutputBytes: cfg.max_output_bytes ?? 32_768,
  };
}

export function initRouter(root: string, database: Database.Database): void {
  repoRoot = root;
  db = database;
  setStatusSessionId(sessionId);
  getMemorySummary(root)
    .then((s) => {
      memoryContext = s;
      logger.debug({ memoryLen: s.length }, 'memory_auto_injected');
    })
    .catch(() => {
      /* auto-inject failure is non-fatal */
    });
  reindexMemoryFts5(root, database).catch(() => {
    /* reindex failure is non-fatal */
  });
}

const PRICING_TABLE: Record<
  string,
  Record<string, { inputPerMillion: number; outputPerMillion: number }>
> = {
  anthropic: {
    'claude-haiku-4-5': { inputPerMillion: 1.0, outputPerMillion: 5.0 },
    'claude-sonnet-4-5': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  },
  openai: {
    'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  },
  ollama: {
    'llama3.1-8b': { inputPerMillion: 0, outputPerMillion: 0 },
  },
};

function estimateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
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
        const msg = err.toUserString();
        logger.warn(
          { kind: err.kind, msg: err.message, session_id: sessionId },
          'rate_limit_error',
        );
        return { isError: true, content: [{ type: 'text', text: `${msg}\nref: ${sessionId}` }] };
      }
      throw err;
    }
    const startTime = Date.now();
    const subagentCfg = getSubagentConfig();
    const result = await searchSubagent(query, subagentCfg);
    recordTokensForRateLimit(result.inputTokens + result.outputTokens);

    const shadowInputTokens = Math.max(result.spans.length, 1) * 4000;
    const tokensSaved = computeTokensSaved(result.inputTokens, shadowInputTokens);
    const queryHash = crypto.createHash('sha256').update(query).digest('hex');
    const estimatedCost = estimateCost(
      subagentCfg.provider,
      subagentCfg.model,
      result.inputTokens,
      result.outputTokens,
    );
    recordUsage({
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      provider: subagentCfg.provider,
      model: subagentCfg.model,
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
    let checkpointPath: string | null = null;
    if (rotFlag) {
      checkpointPath = await createCheckpoint(getRepoRoot(), rotFlag, stats.tokens_used);
    }

    const contextItems = [];
    if (!autoInjectSent && memoryContext && memoryContext !== 'No memory entries yet.') {
      contextItems.push(createStableItem('memory_summary', memoryContext, 0));
      autoInjectSent = true;
    }
    contextItems.push(createDynamicItem('rot_flag', JSON.stringify(rotFlag), 0));
    const spansContent = JSON.stringify(result.spans);
    contextItems.push(createDynamicItem('spans', spansContent, 1));
    contextItems.push(createStableItem('not_found', JSON.stringify(result.not_found), 10));
    contextItems.push(
      createDynamicItem(
        'metadata',
        JSON.stringify({
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          rounds_used: result.roundsUsed,
          tokens_saved: tokensSaved,
        }),
        5,
      ),
    );

    const ordered = orderContext(contextItems);
    const orderedEnvelope: Record<string, unknown> = {};
    for (const item of ordered.items) {
      orderedEnvelope[item.key] = item.content;
    }
    if (rotFlag) {
      orderedEnvelope['rot_flag'] = rotFlag;
      orderedEnvelope['message'] =
        `Context quality is dropping (${rotFlag}). Progress saved at ${checkpointPath ?? 'N/A'}. Recommend starting a fresh session.`;
    }

    logger.debug(
      {
        tokensSaved,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        estimatedCost,
        rotFlag,
      },
      'tokens_saved_computed',
    );
    return { content: [{ type: 'text', text: JSON.stringify(orderedEnvelope) }] };
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
      return {
        isError: true,
        content: [{ type: 'text', text: 'category, heading, and body are required' }],
      };
    }
    try {
      const writtenPath = await writeMemory(getRepoRoot(), category, heading, body);
      reindexMemoryFts5(getRepoRoot(), getDb()).catch(() => {
        /* reindex failure is non-fatal */
      });
      return {
        content: [{ type: 'text', text: JSON.stringify({ written: true, path: writtenPath }) }],
      };
    } catch (err) {
      if (err instanceof MalonError) {
        logger.warn(
          { kind: err.kind, msg: err.message, session_id: sessionId },
          'memory_write_error',
        );
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                written: false,
                reason: `${err.message} (ref: ${sessionId})`,
              }),
            },
          ],
        };
      }
      throw err;
    }
  },

  malon_checkpoint: async (input) => {
    const cause = (input['cause'] as string) ?? 'manual';
    const stats = getSessionStats();
    const checkpointPath = await createCheckpoint(getRepoRoot(), cause, stats.tokens_used);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            checkpoint_created: !!checkpointPath,
            path: checkpointPath,
            cause,
          }),
        },
      ],
    };
  },

  malon_admin: async (input) => {
    if (!db) {
      return { isError: true, content: [{ type: 'text', text: 'Database not initialized' }] };
    }
    try {
      const adminInput = input as unknown as import('../auth/admin-handler.js').AdminInput;
      const result = handleAdmin(db, adminInput);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      logger.warn({ err, session_id: sessionId }, 'admin_handler_error');
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Admin operation failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  },

  malon_status: async () => {
    const stats = await statusCommand(getRepoRoot());

    let checkpointPath: string | null = null;
    if (stats.rot_flag) {
      checkpointPath = await createCheckpoint(getRepoRoot(), stats.rot_flag, stats.tokens_used);
    }

    const memorySummary = await getMemorySummary(getRepoRoot());
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            ...stats,
            memory_summary: memorySummary,
            checkpoint: checkpointPath,
          }),
        },
      ],
    };
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
      logger.warn({ kind: err.kind, msg: err.message, session_id: sessionId }, 'tool_error');
      const msg = err.toUserString();
      return { isError: true, content: [{ type: 'text', text: `${msg}\nref: ${sessionId}` }] };
    }
    logger.error({ err, session_id: sessionId }, 'tool_internal_error');
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Internal error (ref: ${sessionId}). Please report this session ID to the maintainer.`,
        },
      ],
    };
  }
}
