import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from './log.js';
import { setRateLimitConfig } from '../governor/rate-limiter.js';

export interface RateLimitConfig {
  max_calls_per_session?: number;
  max_tokens_per_session?: number;
  window_ms?: number;
}

export interface ParsedConfig {
  rate_limits?: RateLimitConfig;
}

export async function applyConfig(repoRoot: string): Promise<void> {
  const configPath = path.join(repoRoot, '.malon', 'config.yml');
  try {
    const content = await fs.readFile(configPath, 'utf8');
    const config = parseFlatYaml(content);

    const rateLimits = config['rate_limits'];
    if (rateLimits) {
      const opts: { maxCallsPerSession?: number; windowMs?: number; maxTokensPerSession?: number } = {};
      const calls = rateLimits['max_calls_per_session'] as number | undefined;
      if (calls !== undefined) opts.maxCallsPerSession = calls;
      const window = rateLimits['window_ms'] as number | undefined;
      if (window !== undefined) opts.windowMs = window;
      const tokens = rateLimits['max_tokens_per_session'] as number | undefined;
      if (tokens !== undefined) opts.maxTokensPerSession = tokens;
      setRateLimitConfig(opts);
      logger.debug({ limits: rateLimits }, 'rate_limits_configured_from_config');
    }
  } catch (err) {
    logger.debug({ err }, 'config_not_found_using_defaults');
  }
}

function parseFlatYaml(content: string): ParsedConfig {
  const result: Record<string, Record<string, unknown>> = {};
  const lines = content.split('\n');
  let section = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!trimmed.startsWith(' ') && !trimmed.startsWith('\t') && trimmed.endsWith(':')) {
      section = trimmed.slice(0, -1);
      result[section] = {};
    } else if (section && trimmed.includes(':')) {
      const idx = trimmed.indexOf(':');
      const key = trimmed.slice(0, idx).trim();
      let val: string = trimmed.slice(idx + 1).trim();
      if (val === '') continue;
      if (/^\d+$/.test(val)) {
        result[section]![key] = parseInt(val, 10);
      } else if (/^\d+\.\d+$/.test(val)) {
        result[section]![key] = parseFloat(val);
      } else if (val === 'true') {
        result[section]![key] = true;
      } else if (val === 'false') {
        result[section]![key] = false;
      } else {
        result[section]![key] = val;
      }
    }
  }
  return result as unknown as ParsedConfig;
}
