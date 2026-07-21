import { logger } from '../util/log.js';
import type {
  QueryType,
  BenchmarkResult,
  QueryCostBreakdown,
  TypeAggregate,
  PricingEntry,
} from '../types.js';

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
  query_type?: QueryType | undefined;
  native_grep_files?: number | undefined;
  native_grep_matches?: number | undefined;
  estimated_native_read_tokens?: number | undefined;
}

const records: UsageRecord[] = [];
let cumulativeTokensSaved = 0;

export function recordUsage(rec: UsageRecord): void {
  records.push(rec);
  logger.debug(
    {
      input: rec.input_tokens,
      output: rec.output_tokens,
      cost: rec.estimated_cost_usd,
      queryType: rec.query_type,
    },
    'usage_recorded',
  );
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

export function computeTokensSaved(actualInputTokens: number, shadowInputTokens: number): number {
  const saved = shadowInputTokens - actualInputTokens;
  cumulativeTokensSaved += saved;
  return saved;
}

export function getUsageRecords(): readonly UsageRecord[] {
  return records;
}

export function getPricingLabel(provider: string, model: string): string {
  return `${provider}/${model}`;
}

export function computeQueryCostBreakdown(
  query: string,
  queryType: QueryType,
  grepFilesMatched: number,
  grepMatchesFound: number,
  tokensPerFileRead: number,
  avgTokensPerFile: number,
  primaryProvider: string,
  primaryModel: string,
  primaryPricing: PricingEntry,
  subagentProvider: string,
  subagentModel: string,
  subagentPricing: PricingEntry,
  avgSubagentRounds: number,
  avgSubagentTokensPerRound: number,
  avgSpanTokens: number,
): QueryCostBreakdown {
  const nativeReadTokens = grepFilesMatched * tokensPerFileRead;
  const nativeCost = estimateCost(
    nativeReadTokens,
    0,
    primaryPricing.input_per_million,
    primaryPricing.output_per_million,
  );

  const subagentInputTokens = avgSubagentRounds * avgSubagentTokensPerRound;
  const subagentOutputTokens = avgSubagentRounds * (avgSubagentTokensPerRound * 0.3);
  const subagentCost = estimateCost(
    subagentInputTokens,
    subagentOutputTokens,
    subagentPricing.input_per_million,
    subagentPricing.output_per_million,
  );

  const spanTokens = grepFilesMatched * avgSpanTokens;
  const spanCost = estimateCost(
    spanTokens,
    0,
    primaryPricing.input_per_million,
    primaryPricing.output_per_million,
  );

  const malonTotalTokens = subagentInputTokens + subagentOutputTokens + spanTokens;
  const malonTotalCost = subagentCost + spanCost;

  const tokensSaved = Math.max(0, nativeReadTokens - malonTotalTokens);
  const costSaved = Math.max(0, nativeCost - malonTotalCost);
  const tokensPct =
    nativeReadTokens > 0 ? Math.round((tokensSaved / nativeReadTokens) * 1000) / 10 : 0;
  const costPct = nativeCost > 0 ? Math.round((costSaved / nativeCost) * 1000) / 10 : 0;

  return {
    query,
    query_type: queryType,
    native_grep: {
      files_matched: grepFilesMatched,
      matches_found: grepMatchesFound,
      estimated_read_tokens: nativeReadTokens,
      estimated_cost: Math.round(nativeCost * 100000) / 100000,
    },
    malon_search: {
      estimated_spans: grepFilesMatched,
      estimated_subagent_tokens: subagentInputTokens + subagentOutputTokens,
      estimated_subagent_cost: Math.round(subagentCost * 100000) / 100000,
      estimated_span_tokens: spanTokens,
      estimated_span_cost: Math.round(spanCost * 100000) / 100000,
      estimated_total_tokens: malonTotalTokens,
      estimated_total_cost: Math.round(malonTotalCost * 100000) / 100000,
    },
    savings: {
      tokens_saved: tokensSaved,
      percent_saved: tokensPct,
      cost_saved: Math.round(costSaved * 100000) / 100000,
      percent_cost_saved: costPct,
    },
  };
}

export function aggregateByType(breakdowns: QueryCostBreakdown[]): TypeAggregate[] {
  const byType = new Map<QueryType, QueryCostBreakdown[]>();
  for (const b of breakdowns) {
    const arr = byType.get(b.query_type) ?? [];
    arr.push(b);
    byType.set(b.query_type, arr);
  }

  const result: TypeAggregate[] = [];
  for (const [queryType, queries] of byType) {
    const count = queries.length;
    const totalNative = queries.reduce((s, q) => s + q.native_grep.estimated_read_tokens, 0);
    const totalNativeCost = queries.reduce((s, q) => s + q.native_grep.estimated_cost, 0);
    const totalMalon = queries.reduce((s, q) => s + q.malon_search.estimated_total_tokens, 0);
    const totalMalonCost = queries.reduce((s, q) => s + q.malon_search.estimated_total_cost, 0);
    const totalSaved = queries.reduce((s, q) => s + q.savings.tokens_saved, 0);
    const totalCostSaved = queries.reduce((s, q) => s + q.savings.cost_saved, 0);
    const avgPct =
      count > 0
        ? Math.round((queries.reduce((s, q) => s + q.savings.percent_saved, 0) / count) * 10) / 10
        : 0;

    result.push({
      query_type: queryType,
      query_count: count,
      total_native_tokens: totalNative,
      total_native_cost: Math.round(totalNativeCost * 100000) / 100000,
      total_malon_tokens: totalMalon,
      total_malon_cost: Math.round(totalMalonCost * 100000) / 100000,
      total_tokens_saved: totalSaved,
      total_cost_saved: Math.round(totalCostSaved * 100000) / 100000,
      avg_percent_saved: avgPct,
    });
  }

  result.sort((a, b) => b.query_count - a.query_count);
  return result;
}

export function computeFullBenchmark(
  breakdowns: QueryCostBreakdown[],
  primaryProvider: string,
  primaryModel: string,
  primaryPricing: PricingEntry,
  subagentProvider: string,
  subagentModel: string,
  subagentPricing: PricingEntry,
): BenchmarkResult {
  const byType = aggregateByType(breakdowns);
  const totalNative = breakdowns.reduce((s, q) => s + q.native_grep.estimated_read_tokens, 0);
  const totalNativeCost = breakdowns.reduce((s, q) => s + q.native_grep.estimated_cost, 0);
  const totalMalon = breakdowns.reduce((s, q) => s + q.malon_search.estimated_total_tokens, 0);
  const totalMalonCost = breakdowns.reduce((s, q) => s + q.malon_search.estimated_total_cost, 0);
  const totalSaved = breakdowns.reduce((s, q) => s + q.savings.tokens_saved, 0);
  const totalCostSaved = breakdowns.reduce((s, q) => s + q.savings.cost_saved, 0);

  return {
    timestamp: new Date().toISOString(),
    total_queries: breakdowns.length,
    by_type: byType,
    overall: {
      total_native_tokens: totalNative,
      total_native_cost: Math.round(totalNativeCost * 100000) / 100000,
      total_malon_tokens: totalMalon,
      total_malon_cost: Math.round(totalMalonCost * 100000) / 100000,
      total_tokens_saved: totalSaved,
      total_cost_saved: Math.round(totalCostSaved * 100000) / 100000,
      overall_percent_tokens_saved:
        totalNative > 0 ? Math.round((totalSaved / totalNative) * 1000) / 10 : 0,
      overall_percent_cost_saved:
        totalNativeCost > 0 ? Math.round((totalCostSaved / totalNativeCost) * 1000) / 10 : 0,
    },
    pricing_used: {
      primary_provider: primaryProvider,
      primary_model: primaryModel,
      primary_input_per_million: primaryPricing.input_per_million,
      primary_output_per_million: primaryPricing.output_per_million,
      subagent_provider: subagentProvider,
      subagent_model: subagentModel,
      subagent_input_per_million: subagentPricing.input_per_million,
      subagent_output_per_million: subagentPricing.output_per_million,
    },
    queries: breakdowns,
  };
}

function estimateCost(
  inputTokens: number,
  outputTokens: number,
  inputPricePerMillion: number,
  outputPricePerMillion: number,
): number {
  const inputCost = (inputTokens / 1_000_000) * inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * outputPricePerMillion;
  return inputCost + outputCost;
}
