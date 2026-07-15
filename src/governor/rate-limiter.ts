import { MalonError } from '../types.js';
import { logger } from '../util/log.js';

const DEFAULT_WINDOW_MS = 60_000;

interface SessionState {
  callCount: number;
  maxCallsPerSession: number;
  resetAt: number;
  totalTokensUsed: number;
  maxTokensPerSession: number;
}

const sessionState: SessionState = {
  callCount: 0,
  maxCallsPerSession: 100,
  resetAt: Date.now() + DEFAULT_WINDOW_MS,
  totalTokensUsed: 0,
  maxTokensPerSession: 500_000,
};

export function setRateLimitConfig(opts: {
  maxCallsPerSession?: number;
  windowMs?: number;
  maxTokensPerSession?: number;
}): void {
  if (opts.maxCallsPerSession !== undefined) {
    sessionState.maxCallsPerSession = opts.maxCallsPerSession;
  }
  if (opts.windowMs !== undefined) {
    sessionState.resetAt = Date.now() + opts.windowMs;
  }
  if (opts.maxTokensPerSession !== undefined) {
    sessionState.maxTokensPerSession = opts.maxTokensPerSession;
  }
}

export function getRateLimitState(): {
  callCount: number;
  totalTokensUsed: number;
  remainingCalls: number;
  remainingTokens: number;
} {
  return {
    callCount: sessionState.callCount,
    totalTokensUsed: sessionState.totalTokensUsed,
    remainingCalls: Math.max(0, sessionState.maxCallsPerSession - sessionState.callCount),
    remainingTokens: Math.max(0, sessionState.maxTokensPerSession - sessionState.totalTokensUsed),
  };
}

export function checkRateLimit(tokensToAdd: number): void {
  if (Date.now() > sessionState.resetAt) {
    sessionState.callCount = 0;
    sessionState.totalTokensUsed = 0;
    sessionState.resetAt = Date.now() + DEFAULT_WINDOW_MS;
    logger.debug({}, 'rate_limit_window_reset');
  }

  if (sessionState.callCount >= sessionState.maxCallsPerSession) {
    logger.warn(
      { callCount: sessionState.callCount, maxCalls: sessionState.maxCallsPerSession },
      'rate_limit_calls_exceeded',
    );
    throw new MalonError(
      'config',
      `Rate limit exceeded: ${sessionState.maxCallsPerSession} calls per window`,
      'Wait for the rate limit window to reset, or adjust limits in config.yml',
    );
  }

  if (sessionState.totalTokensUsed + tokensToAdd > sessionState.maxTokensPerSession) {
    logger.warn(
      { totalTokensUsed: sessionState.totalTokensUsed, tokensToAdd },
      'rate_limit_tokens_exceeded',
    );
    throw new MalonError(
      'config',
      `Token rate limit exceeded: ${sessionState.maxTokensPerSession} tokens per session`,
      'Start a new session or adjust limits in config.yml',
    );
  }

  sessionState.callCount++;
}

export function recordTokensForRateLimit(tokens: number): void {
  sessionState.totalTokensUsed += tokens;
}

export function resetRateLimitState(): void {
  sessionState.callCount = 0;
  sessionState.totalTokensUsed = 0;
  sessionState.maxCallsPerSession = 100;
  sessionState.maxTokensPerSession = 500_000;
  sessionState.resetAt = Date.now() + DEFAULT_WINDOW_MS;
}
