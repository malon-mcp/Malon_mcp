import { MalonError } from '../types.js';

export class PathEscapeError extends MalonError {
  constructor(path: string) {
    super('path_escape', `Refusing to access path outside repo: ${path}`);
    this.name = 'PathEscapeError';
  }
}

export class SanitizedFts5Error extends MalonError {
  constructor(
    message: string,
    public readonly original: string,
  ) {
    super('sql_injection', message, 'Refine your search query.');
    this.name = 'SanitizedFts5Error';
  }
}

export class SubagentTimeoutError extends MalonError {
  constructor(
    public readonly round: number,
    _partial: unknown,
  ) {
    super(
      'subagent_timeout',
      `Subagent timed out on round ${round}`,
      'Increase search.subagent_timeout_ms in config.yml',
    );
    this.name = 'SubagentTimeoutError';
  }
}

export class SecretLeakSuspectedError extends MalonError {
  constructor(
    public readonly pattern: string,
    excerpt: string,
  ) {
    super(
      'secret_leak',
      `Pattern "${pattern}" matched. Excerpt: ${excerpt}`,
      'Redact the sensitive content and retry.',
    );
    this.name = 'SecretLeakSuspectedError';
  }
}

export class ConfigError extends MalonError {
  constructor(message: string, fix?: string) {
    super('config', message, fix ?? 'Run `malon init` to regenerate config.yml');
    this.name = 'ConfigError';
  }
}

export class IndexStaleError extends MalonError {
  constructor(lastSha: string, headSha: string) {
    super(
      'index_stale',
      `Index is stale (${lastSha} vs ${headSha})`,
      'Run `malon init --incremental`',
    );
    this.name = 'IndexStaleError';
  }
}
