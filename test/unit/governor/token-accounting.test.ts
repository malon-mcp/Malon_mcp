import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordUsage, getSessionStats, computeTokensSaved, getUsageRecords } from '../../../dist/governor/token-accounting.js';

test('recordUsage and getSessionStats work correctly', () => {
  while (getUsageRecords().length > 0) {
    getUsageRecords().pop();
  }

  recordUsage({
    timestamp: '2026-07-14T00:00:00.000Z',
    session_id: 'test-session',
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    query: 'test query',
    query_hash: 'abc',
    input_tokens: 100,
    output_tokens: 50,
    estimated_cost_usd: 0.00035,
    round: 1,
    latency_ms: 500,
  });

  const stats = getSessionStats();
  assert.equal(stats.tokens_used, 150);
  assert.equal(stats.spend_usd, 0.00035);
});

test('computeTokensSaved calculates correctly', () => {
  const saved = computeTokensSaved(100, 400);
  assert.equal(saved, 300);
});
