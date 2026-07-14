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

export interface SearchSpan {
  file_path: string;
  start_line: number;
  end_line: number;
  justification: string;
}

export interface SearchResult {
  spans: SearchSpan[];
  not_found: boolean;
}

export interface MemoryEntry {
  category: 'decisions' | 'conventions' | 'rejected' | 'session';
  heading: string;
  body: string;
  path?: string;
}

export interface StatusResult {
  session_id: string;
  spend_usd: number;
  tokens_used: number;
  tokens_saved_cumulative: number;
  rot_flag: string | null;
  last_index_sha: string;
  uptime_ms: number;
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

export interface MalonConfig {
  pricing: PricingConfig;
  search: SearchConfig;
  cost: CostConfig;
  log: LogConfig;
  telemetry: { enabled: boolean };
}
