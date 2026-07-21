import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from './log.js';
import { setRateLimitConfig } from '../governor/rate-limiter.js';
import { setRetentionConfig } from '../governor/retention.js';
import { validatePricingAge } from '../governor/pricing.js';
import type { PricingEntry } from '../types.js';

export interface RateLimitConfig {
  max_calls_per_session?: number;
  max_tokens_per_session?: number;
  window_ms?: number;
}

export interface SearchConfig {
  provider?: string | undefined;
  model?: string | undefined;
  subagent_timeout_ms?: number | undefined;
  max_rounds?: number | undefined;
  max_output_bytes?: number | undefined;
}

interface RetentionCfg {
  usage_log_max_age_days?: number;
  usage_log_max_size_mb?: number;
  auto_prune_on_start?: boolean;
}

export interface NestedConfig {
  rate_limits?: Record<string, unknown>;
  search?: Record<string, unknown>;
  retention?: Record<string, unknown>;
  pricing?: {
    last_verified?: string;
    providers?: Record<string, Record<string, PricingEntry>>;
  };
  cost?: Record<string, unknown>;
}

let cachedSearchConfig: SearchConfig | null = null;
let cachedPricing: {
  last_verified: string;
  providers: Record<string, Record<string, PricingEntry>>;
} | null = null;

export function getSearchConfig(): SearchConfig {
  return cachedSearchConfig ?? {};
}

export function getPricingConfig(): {
  last_verified: string;
  providers: Record<string, Record<string, PricingEntry>>;
} | null {
  return cachedPricing;
}

export function getActivePricing(): {
  provider: string;
  model: string;
  pricing: PricingEntry;
} | null {
  if (!cachedPricing) return null;
  const search = cachedSearchConfig;
  if (!search?.provider || !search?.model) return null;
  const providerConfig = cachedPricing.providers[search.provider];
  if (!providerConfig) return null;
  const modelPricing = providerConfig[search.model];
  if (!modelPricing) return null;
  return { provider: search.provider, model: search.model, pricing: modelPricing };
}

export async function applyConfig(repoRoot: string): Promise<void> {
  const configPath = path.join(repoRoot, '.malon', 'config.yml');
  try {
    const content = await fs.readFile(configPath, 'utf8');
    const config = parseNestedYaml(content);

    const rateLimits = config['rate_limits'];
    if (rateLimits) {
      const opts: { maxCallsPerSession?: number; windowMs?: number; maxTokensPerSession?: number } =
        {};
      const calls = rateLimits['max_calls_per_session'] as number | undefined;
      if (calls !== undefined) opts.maxCallsPerSession = calls;
      const window = rateLimits['window_ms'] as number | undefined;
      if (window !== undefined) opts.windowMs = window;
      const tokens = rateLimits['max_tokens_per_session'] as number | undefined;
      if (tokens !== undefined) opts.maxTokensPerSession = tokens;
      setRateLimitConfig(opts);
      logger.debug({ limits: rateLimits }, 'rate_limits_configured_from_config');
    }

    const searchConfig = config['search'];
    if (searchConfig) {
      cachedSearchConfig = {
        provider: searchConfig['provider'] as string | undefined,
        model: searchConfig['model'] as string | undefined,
        subagent_timeout_ms: searchConfig['subagent_timeout_ms'] as number | undefined,
        max_rounds: searchConfig['max_rounds'] as number | undefined,
        max_output_bytes: searchConfig['max_output_bytes'] as number | undefined,
      };
      logger.debug({ search: cachedSearchConfig }, 'search_config_loaded');
    }

    const retention = config['retention'];
    if (retention) {
      const cfg: RetentionCfg = {};
      const days = retention['usage_log_max_age_days'];
      if (days !== undefined) cfg.usage_log_max_age_days = days as number;
      const size = retention['usage_log_max_size_mb'];
      if (size !== undefined) cfg.usage_log_max_size_mb = size as number;
      const prune = retention['auto_prune_on_start'];
      if (prune !== undefined) cfg.auto_prune_on_start = prune as boolean;
      setRetentionConfig(cfg);
      logger.debug({ retention }, 'retention_config_loaded');
    }

    const pricing = config['pricing'];
    if (pricing?.last_verified) {
      const providers = pricing.providers ?? {};
      validatePricingAge({
        last_verified: pricing.last_verified,
        providers,
      });
      cachedPricing = {
        last_verified: pricing.last_verified,
        providers,
      };
      logger.debug({ last_verified: pricing.last_verified }, 'pricing_config_loaded');
    }

    const cost = config['cost'];
    if (cost) {
      logger.debug({ cost }, 'cost_config_loaded');
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'ConfigError') {
      throw err;
    }
    logger.debug({ err }, 'config_not_found_using_defaults');
  }
}

function parseNestedYaml(content: string): NestedConfig {
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');

  const stack: { indent: number; key: string; obj: Record<string, unknown> }[] = [];

  for (const rawLine of lines) {
    if (rawLine.trim() === '' || rawLine.trimStart().startsWith('#')) continue;

    const indent = rawLine.length - rawLine.trimStart().length;
    const trimmed = rawLine.trim();

    if (trimmed.endsWith(':')) {
      const key = trimmed.slice(0, -1);
      let parent = stack.length > 0 ? (stack[stack.length - 1] ?? null) : null;

      while (parent && indent <= parent.indent) {
        stack.pop();
        parent = stack.length > 0 ? (stack[stack.length - 1] ?? null) : null;
      }
      const newParent = stack.length > 0 ? (stack[stack.length - 1] ?? null) : null;

      const newObj: Record<string, unknown> = {};
      if (newParent) {
        newParent.obj[key] = newObj;
      } else {
        result[key] = newObj;
      }
      stack.push({ indent, key, obj: newObj });
    } else if (trimmed.includes(':')) {
      const idx = trimmed.indexOf(':');
      const key = trimmed.slice(0, idx).trim();
      let val: string = trimmed.slice(idx + 1).trim();

      while (stack.length > 0) {
        const lastItem = stack[stack.length - 1];
        if (!lastItem || indent > lastItem.indent) break;
        stack.pop();
      }
      const parent = stack.length > 0 ? stack[stack.length - 1] : null;

      val = val.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');

      const parsed: unknown =
        val === ''
          ? ''
          : /^\d+$/.test(val)
            ? parseInt(val, 10)
            : /^\d+\.\d+$/.test(val)
              ? parseFloat(val)
              : val === 'true'
                ? true
                : val === 'false'
                  ? false
                  : val;

      if (parent) {
        parent.obj[key] = parsed;
      } else {
        result[key] = parsed;
      }
    }
  }

  return result as unknown as NestedConfig;
}
