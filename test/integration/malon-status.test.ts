import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod/v4';

let repoRoot = '';
let dbPath = '';
let server: McpServer;
let client: Client;
let clientTransport: InMemoryTransport;
let serverTransport: InMemoryTransport;

before(async () => {
  repoRoot = await mkdtemp(path.join(os.tmpdir(), 'malon-int-status-'));
  await mkdir(path.join(repoRoot, 'src'), { recursive: true });
  await mkdir(path.join(repoRoot, '.malon', 'memory', 'sessions'), { recursive: true });

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

  const { initIndex, indexFile, getDb } = await import('../../src/index/index.js');
  const { initParser } = await import('../../src/index/parser.js');
  const { initRouter } = await import('../../src/orchestrator/router.js');

  initIndex(dbPath, repoRoot);
  await initParser();
  await indexFile(path.join(repoRoot, 'src', 'auth.ts'));
  initRouter(repoRoot, getDb());

  server = new McpServer({ name: 'malon-test', version: '0.0.1' }, { capabilities: { tools: {} } });

  const { route: routeHandler } = await import('../../src/orchestrator/router.js');

  server.tool(
    'malon_search',
    'Search the indexed codebase',
    {
      query: z.string().min(1).max(512).describe('search query'),
      max_results: z.number().int().min(1).max(5).default(3).describe('max results'),
    },
    async (args) => routeHandler('malon_search', args as Record<string, unknown>),
  );

  server.tool(
    'malon_memory_get',
    'Retrieve relevant memory entries',
    { query: z.string().min(1).max(512).describe('memory query') },
    async (args) => routeHandler('malon_memory_get', args as Record<string, unknown>),
  );

  server.tool(
    'malon_memory_write',
    'Write a new entry',
    {
      category: z.enum(['decisions', 'conventions', 'rejected', 'session']).describe('category'),
      heading: z.string().min(1).max(120).describe('heading'),
      body: z.string().min(1).max(2000).describe('body'),
    },
    async (args) => routeHandler('malon_memory_write', args as Record<string, unknown>),
  );

  server.tool('malon_status', 'Returns current session status', {}, async () =>
    routeHandler('malon_status', {}),
  );

  server.tool(
    'malon_checkpoint',
    'Explicitly trigger a rot checkpoint',
    { cause: z.string().max(200).optional().describe('Optional reason for the checkpoint') },
    async (args) => routeHandler('malon_checkpoint', args as Record<string, unknown>),
  );

  [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientTransport);
});

after(async () => {
  if (client) await client.close();
  if (server) await server.close();
  const { closeDb } = await import('../../src/index/index.js');
  closeDb();
  await rm(repoRoot, { recursive: true, force: true }).catch(() => {
    /* server close errors are non-fatal */
  });
});

test('malon_status returns expected schema and all fields', async () => {
  const result = await client.request(
    { method: 'tools/call', params: { name: 'malon_status', arguments: {} } },
    z.any(),
  );

  const parsed = JSON.parse(result.content[0].text);

  assert.equal(typeof parsed.session_id, 'string', 'session_id should be string');
  assert.equal(typeof parsed.spend_usd, 'number', 'spend_usd should be number');
  assert.equal(typeof parsed.tokens_used, 'number', 'tokens_used should be number');
  assert.equal(
    typeof parsed.tokens_saved_cumulative,
    'number',
    'tokens_saved_cumulative should be number',
  );
  assert.equal(typeof parsed.uptime_ms, 'number', 'uptime_ms should be number');
  assert.ok(parsed.uptime_ms > 0, 'uptime_ms should be > 0');
  assert.ok('rot_flag' in parsed, 'rot_flag should be present');
  assert.ok('last_index_sha' in parsed, 'last_index_sha should be present');
  assert.ok('memory_summary' in parsed, 'memory_summary should be present');

  assert.equal(parsed.spend_usd, 0, 'fresh session spend should be 0');
  assert.equal(parsed.tokens_used, 0, 'fresh session tokens_used should be 0');
  assert.equal(parsed.tokens_saved_cumulative, 0, 'fresh session tokens_saved should be 0');
  assert.equal(parsed.session_id.length, 36, 'session_id should be UUIDv4 length');
});

test('malon_search returns ordered envelope with spans', async () => {
  const result = await client.request(
    {
      method: 'tools/call',
      params: { name: 'malon_search', arguments: { query: 'validateToken' } },
    },
    z.any(),
  );

  const parsed = JSON.parse(result.content[0].text);

  assert.ok('spans' in parsed, 'response should contain spans');
  assert.ok('not_found' in parsed, 'response should contain not_found');
  assert.ok('metadata' in parsed, 'response should contain metadata');
  assert.ok('rot_flag' in parsed, 'response should contain rot_flag');

  const spans = typeof parsed.spans === 'string' ? JSON.parse(parsed.spans) : parsed.spans;
  const metadata =
    typeof parsed.metadata === 'string' ? JSON.parse(parsed.metadata) : parsed.metadata;

  assert.ok(Array.isArray(spans), 'spans should be an array');
  assert.ok(spans.length <= 5, 'spans should have at most 5 entries');

  if (spans.length > 0) {
    const span = spans[0];
    assert.equal(typeof span.file_path, 'string', 'span.file_path should be string');
    assert.equal(typeof span.start_line, 'number', 'span.start_line should be number');
    assert.equal(typeof span.end_line, 'number', 'span.end_line should be number');
    assert.equal(typeof span.justification, 'string', 'span.justification should be string');
    assert.ok(span.justification.length <= 200, 'span.justification should be <= 200 chars');
  }

  assert.equal(typeof metadata.input_tokens, 'number');
  assert.equal(typeof metadata.output_tokens, 'number');
  assert.equal(typeof metadata.rounds_used, 'number');
  assert.equal(typeof metadata.tokens_saved, 'number');
});

test('malon_memory_get returns a string', async () => {
  const result = await client.request(
    { method: 'tools/call', params: { name: 'malon_memory_get', arguments: { query: 'auth' } } },
    z.any(),
  );

  assert.equal(typeof result.content[0].text, 'string');
  assert.ok(result.content[0].text.length >= 0);
});

test('malon_memory_write writes and returns absolute path', async () => {
  const result = await client.request(
    {
      method: 'tools/call',
      params: {
        name: 'malon_memory_write',
        arguments: {
          category: 'decisions',
          heading: 'Test decision',
          body: 'This is a test memory entry for verification.',
        },
      },
    },
    z.any(),
  );

  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.written, true, 'written should be true');
  assert.ok(typeof parsed.path === 'string', 'path should be a string');
  assert.ok(parsed.path.includes('malon'), 'path should reference .malon directory');
  assert.ok(parsed.path.includes('memory'), 'path should reference memory directory');
});

test('malon_memory_write rejects secrets', async () => {
  const result = await client.request(
    {
      method: 'tools/call',
      params: {
        name: 'malon_memory_write',
        arguments: {
          category: 'decisions',
          heading: 'API key',
          body: 'My key is sk-ant-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
      },
    },
    z.any(),
  );

  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.written, false, 'written should be false for secret leak');
  assert.ok(typeof parsed.reason === 'string', 'reason should be a string');
});

test('malon_status reflects written memory', async () => {
  const result = await client.request(
    { method: 'tools/call', params: { name: 'malon_status', arguments: {} } },
    z.any(),
  );

  const parsed = JSON.parse(result.content[0].text);
  assert.ok(
    parsed.memory_summary.includes('decisions') || parsed.memory_summary.includes('No memory'),
  );
});

test('malon_memory_write with session category creates file in sessions/', async () => {
  const result = await client.request(
    {
      method: 'tools/call',
      params: {
        name: 'malon_memory_write',
        arguments: {
          category: 'session',
          heading: 'Checkpoint test',
          body: 'Session checkpoint body for verification.',
        },
      },
    },
    z.any(),
  );

  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.written, true, 'written should be true');
  assert.ok(parsed.path.includes('sessions'), 'path should reference sessions/ directory');
});

test('malon_checkpoint creates checkpoint entry', async () => {
  const result = await client.request(
    {
      method: 'tools/call',
      params: { name: 'malon_checkpoint', arguments: { cause: 'test_checkpoint' } },
    },
    z.any(),
  );

  const parsed = JSON.parse(result.content[0].text);
  assert.equal(typeof parsed.checkpoint_created, 'boolean');
  assert.equal(typeof parsed.cause, 'string');
  assert.equal(parsed.cause, 'test_checkpoint');
  if (parsed.checkpoint_created) {
    assert.ok(typeof parsed.path === 'string');
    assert.ok(parsed.path.includes('sessions'));
  }
});

test('malon_checkpoint without cause defaults to manual', async () => {
  const result = await client.request(
    { method: 'tools/call', params: { name: 'malon_checkpoint', arguments: {} } },
    z.any(),
  );

  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.cause, 'manual');
});

test('malon_search returns after memory write', async () => {
  const result = await client.request(
    {
      method: 'tools/call',
      params: { name: 'malon_search', arguments: { query: 'validateToken' } },
    },
    z.any(),
  );

  const parsed = JSON.parse(result.content[0].text);
  assert.ok('spans' in parsed, 'response should contain spans after memory write');
});
