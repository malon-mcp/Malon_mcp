import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit, recordTokensForRateLimit, resetRateLimitState, getRateLimitState, setRateLimitConfig } from '../../../dist/governor/rate-limiter.js';
import { MalonError } from '../../../dist/types.js';

test('checkRateLimit allows calls under the limit', () => {
  resetRateLimitState();
  checkRateLimit(100);
  const state = getRateLimitState();
  assert.equal(state.callCount, 1);
  assert.equal(state.remainingCalls, 99);
});

test('checkRateLimit throws when call limit exceeded', () => {
  resetRateLimitState();
  setRateLimitConfig({ maxCallsPerSession: 3 });

  checkRateLimit(100);
  checkRateLimit(100);
  checkRateLimit(100);

  assert.throws(
    () => checkRateLimit(100),
    (err: unknown) => err instanceof MalonError && err.message.includes('Rate limit exceeded'),
  );
});

test('checkRateLimit throws when token limit exceeded', () => {
  resetRateLimitState();
  setRateLimitConfig({ maxTokensPerSession: 500 });

  checkRateLimit(300);
  recordTokensForRateLimit(300);

  assert.throws(
    () => checkRateLimit(300),
    (err: unknown) => err instanceof MalonError && err.message.includes('Token rate limit exceeded'),
  );
});

test('getRateLimitState returns correct remaining values', () => {
  resetRateLimitState();
  setRateLimitConfig({ maxCallsPerSession: 10, maxTokensPerSession: 1000 });

  checkRateLimit(200);
  recordTokensForRateLimit(200);

  const state = getRateLimitState();
  assert.equal(state.callCount, 1);
  assert.equal(state.totalTokensUsed, 200);
  assert.equal(state.remainingCalls, 9);
  assert.equal(state.remainingTokens, 800);
});

test('resetRateLimitState clears all counters', () => {
  resetRateLimitState();
  setRateLimitConfig({ maxCallsPerSession: 2 });

  checkRateLimit(100);
  checkRateLimit(100);

  resetRateLimitState();

  const state = getRateLimitState();
  assert.equal(state.callCount, 0);
  assert.equal(state.totalTokensUsed, 0);
});

test('rate limit window resets after timeout expires', () => {
  resetRateLimitState();
  setRateLimitConfig({ maxCallsPerSession: 1 });

  checkRateLimit(100);

  assert.throws(
    () => checkRateLimit(100),
    (err: unknown) => err instanceof MalonError,
  );
});

test('recordTokensForRateLimit accumulates token count', () => {
  resetRateLimitState();

  recordTokensForRateLimit(100);
  recordTokensForRateLimit(200);
  recordTokensForRateLimit(300);

  const state = getRateLimitState();
  assert.equal(state.totalTokensUsed, 600);
});

test('default config allows reasonable usage', () => {
  resetRateLimitState();

  for (let i = 0; i < 50; i++) {
    checkRateLimit(1000);
    recordTokensForRateLimit(1000);
  }

  const state = getRateLimitState();
  assert.equal(state.callCount, 50);
  assert.equal(state.totalTokensUsed, 50000);
});

test('checkRateLimit tracks calls across token recording', () => {
  resetRateLimitState();

  checkRateLimit(200);
  recordTokensForRateLimit(300);
  checkRateLimit(150);
  recordTokensForRateLimit(250);

  const state = getRateLimitState();
  assert.equal(state.callCount, 2);
  assert.equal(state.totalTokensUsed, 550);
});