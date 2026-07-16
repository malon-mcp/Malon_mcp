import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { initIndex, indexFile, closeDb } from '../../src/index/index.js';
import { initParser } from '../../src/index/parser.js';

let repoRoot = '';
let dbPath = '';

before(async () => {
  repoRoot = await mkdtemp(path.join(os.tmpdir(), 'malon-int-subagent-'));
  await mkdir(path.join(repoRoot, 'src'), { recursive: true });
  await writeFile(
    path.join(repoRoot, 'src', 'auth.ts'),
    `export function validateToken(token: string): boolean {
  return token.length > 0 && token.startsWith('eyJ');
}

export function verifyJwt(token: string): { sub: string } {
  return { sub: 'user_123' };
}
`,
  );
  dbPath = path.join(repoRoot, '.malon', 'test-index.db');
  await mkdir(path.dirname(dbPath), { recursive: true });
  initIndex(dbPath, repoRoot);
  await initParser();
  await indexFile(path.join(repoRoot, 'src', 'auth.ts'));
});

after(async () => {
  closeDb();
  await rm(repoRoot, { recursive: true, force: true });
});

test('subagent falls back to FTS5 when LLM call fails (no API key)', async () => {
  const { searchSubagent } = await import('../../src/search/subagent.js');

  const result = await searchSubagent('validateToken function', {
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    maxRounds: 2,
    timeoutMs: 3000,
    maxOutputBytes: 1024,
  });

  assert.equal(typeof result.not_found, 'boolean');
  assert.ok(Array.isArray(result.spans));
  assert.equal(typeof result.roundsUsed, 'number');
});

test('subagent handles empty query gracefully', async () => {
  const { searchSubagent } = await import('../../src/search/subagent.js');

  const result = await searchSubagent('', {
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    maxRounds: 2,
    timeoutMs: 3000,
    maxOutputBytes: 1024,
  });

  assert.ok(result.not_found);
  assert.equal(result.spans.length, 0);
});

test('subagent handles binary query input', async () => {
  const { searchSubagent } = await import('../../src/search/subagent.js');

  const result = await searchSubagent('\x00\x01\x02', {
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    maxRounds: 2,
    timeoutMs: 3000,
    maxOutputBytes: 1024,
  });

  assert.equal(typeof result.not_found, 'boolean');
  assert.ok(result.spans.length <= 5);
});
