import { logger } from '../util/log.js';

interface UsageRecord {
  timestamp: string;
  session_id: string;
  provider: string;
  model: string;
  query: string;
  query_hash: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  round: number;
  latency_ms: number;
}

const records: UsageRecord[] = [];
let cumulativeTokensSaved = 0;

export function recordUsage(rec: UsageRecord): void {
  records.push(rec);
  logger.debug({ input: rec.input_tokens, output: rec.output_tokens, cost: rec.estimated_cost_usd }, 'usage_recorded');
}

export function getSessionStats(): {
  tokens_used: number;
  spend_usd: number;
  tokens_saved_cumulative: number;
} {
  const tokens_used = records.reduce((s, r) => s + r.input_tokens + r.output_tokens, 0);
  const spend_usd = records.reduce((s, r) => s + r.estimated_cost_usd, 0);
  return { tokens_used, spend_usd, tokens_saved_cumulative: cumulativeTokensSaved };
}

export function computeTokensSaved(
  actualInputTokens: number,
  shadowInputTokens: number,
): number {
  const saved = shadowInputTokens - actualInputTokens;
  cumulativeTokensSaved += saved;
  return saved;
}

export function getUsageRecords(): readonly UsageRecord[] {
  return records;
}
