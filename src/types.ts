export type MalonErrorKind =
  | 'config'
  | 'path_escape'
  | 'sql_injection'
  | 'subagent_timeout'
  | 'secret_leak'
  | 'index_stale'
  | 'tool_not_found'
  | 'internal';

export class MalonError extends Error {
  constructor(
    public readonly kind: MalonErrorKind,
    message: string,
    public readonly fix?: string,
  ) {
    super(message);
    this.name = 'MalonError';
  }

  toUserString(): string {
    let s = `error: ${this.kind}: ${this.message}`;
    if (this.fix) s += `\ntry:    ${this.fix}`;
    return s;
  }
}

export type Result<T, E = MalonError> = { ok: true; value: T } | { ok: false; error: E };

export type QueryType = 'symbol_lookup' | 'cross_file' | 'error_handling' | 'mixed';

export interface SearchSpan {
  file_path: string;
  start_line: number;
  end_line: number;
  justification: string;
}

export interface SearchResult {
  spans: SearchSpan[];
  not_found: boolean;
  query_type?: QueryType;
}

export interface MemoryEntry {
  category: 'decisions' | 'conventions' | 'rejected' | 'session';
  heading: string;
  body: string;
  path?: string;
}

export interface QueryCostBreakdown {
  query: string;
  query_type: QueryType;
  native_grep: {
    files_matched: number;
    matches_found: number;
    estimated_read_tokens: number;
    estimated_cost: number;
  };
  malon_search: {
    estimated_spans: number;
    estimated_subagent_tokens: number;
    estimated_subagent_cost: number;
    estimated_span_tokens: number;
    estimated_span_cost: number;
    estimated_total_tokens: number;
    estimated_total_cost: number;
  };
  savings: {
    tokens_saved: number;
    percent_saved: number;
    cost_saved: number;
    percent_cost_saved: number;
  };
}

export interface TypeAggregate {
  query_type: QueryType;
  query_count: number;
  total_native_tokens: number;
  total_native_cost: number;
  total_malon_tokens: number;
  total_malon_cost: number;
  total_tokens_saved: number;
  total_cost_saved: number;
  avg_percent_saved: number;
}

export interface BenchmarkResult {
  timestamp: string;
  total_queries: number;
  by_type: TypeAggregate[];
  overall: {
    total_native_tokens: number;
    total_native_cost: number;
    total_malon_tokens: number;
    total_malon_cost: number;
    total_tokens_saved: number;
    total_cost_saved: number;
    overall_percent_tokens_saved: number;
    overall_percent_cost_saved: number;
  };
  pricing_used: {
    primary_provider: string;
    primary_model: string;
    primary_input_per_million: number;
    primary_output_per_million: number;
    subagent_provider: string;
    subagent_model: string;
    subagent_input_per_million: number;
    subagent_output_per_million: number;
  };
  queries: QueryCostBreakdown[];
}

export interface StatusResult {
  session_id: string;
  spend_usd: number;
  tokens_used: number;
  tokens_saved_cumulative: number;
  rot_flag: string | null;
  last_index_sha: string;
  uptime_ms: number;
  local_mode: boolean;
  local_model?: string | undefined;
  active_pricing?:
    | {
        provider: string;
        model: string;
        input_per_million: number;
        output_per_million: number;
      }
    | undefined;
}

export interface PricingEntry {
  input_per_million: number;
  output_per_million: number;
}

export interface PricingConfig {
  last_verified: string;
  providers: Record<string, Record<string, PricingEntry>>;
}

export interface SearchConfig {
  provider: string;
  model: string;
  subagent_timeout_ms: number;
  max_rounds: number;
  max_output_bytes: number;
}

export interface ShadowConfig {
  tokens_per_file_read: number;
  avg_tokens_per_file: number;
}

export interface CostConfig {
  ceiling_usd: number;
  shadow: ShadowConfig;
}

export interface LogConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  file: string;
}

export interface RetentionConfig {
  usage_log_max_age_days: number;
  usage_log_max_size_mb: number;
  auto_prune_on_start: boolean;
}

export interface AuthConfig {
  session_ttl_minutes: number;
  api_key_prefix: string;
  max_api_keys_per_user: number;
  mfa_enforced: boolean;
}

export interface MalonConfig {
  pricing: PricingConfig;
  search: SearchConfig;
  cost: CostConfig;
  log: LogConfig;
  retention: RetentionConfig;
  auth: AuthConfig;
  telemetry: { enabled: boolean };
}
