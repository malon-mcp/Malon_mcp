import { ConfigError } from '../util/errors.js';
import { logger } from '../util/log.js';

const WARN_DAYS = 30;
const REFUSE_DAYS = 90;
const MS_PER_DAY = 86_400_000;

export interface PricingEntry {
  input_per_million: number;
  output_per_million: number;
}

export interface PricingConfig {
  last_verified: string;
  providers: Record<string, Record<string, PricingEntry>>;
}

export function validatePricingAge(config: PricingConfig): void {
  const lastVerified = new Date(config.last_verified);
  const now = new Date();
  const ageMs = now.getTime() - lastVerified.getTime();
  const ageDays = ageMs / MS_PER_DAY;

  if (Number.isNaN(ageDays) || ageDays < 0) {
    throw new ConfigError(
      `Invalid pricing.last_verified date: "${config.last_verified}". Expected ISO 8601 date (e.g., 2026-07-01).`,
    );
  }

  if (ageDays >= REFUSE_DAYS) {
    throw new ConfigError(
      `Pricing config is ${Math.floor(ageDays)} days old (last_verified: ${config.last_verified}). ` +
      'Update pricing.last_verified in .malon/config.yml before starting the server.',
      `Set pricing.last_verified to today's date in .malon/config.yml`,
    );
  }

  if (ageDays >= WARN_DAYS) {
    logger.warn(
      { ageDays: Math.floor(ageDays), lastVerified: config.last_verified },
      'pricing_config_age_warning',
    );
  }
}
