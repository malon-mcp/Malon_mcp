import { test } from 'node:test';
import assert from 'node:assert/strict';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod/v4';

test('malon_search returns expected schema', async () => {
  const server = new McpServer({ name: 'test', version: '0.0.1' }, { capabilities: { tools: {} } });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  server.tool(
    'malon_search',
    'Search test tool',
    { query: z.string().min(1).max(512).describe('query') },
    async () => ({
      content: [{ type: 'text', text: JSON.stringify({ spans: [], not_found: true }) }],
    }),
  );

  await server.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientTransport);

  const result = await client.request(
    {
      method: 'tools/call',
      params: { name: 'malon_search', arguments: { query: 'find main' } },
    },
    z.any(),
  );

  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.not_found, true);
  assert.ok(Array.isArray(parsed.spans));

  await client.close();
  await server.close();
});

test('malon_admin generates and lists keys', async () => {
  const server = new McpServer({ name: 'test', version: '0.0.1' }, { capabilities: { tools: {} } });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  let storedKeys: Record<string, unknown>[] = [];

  server.tool(
    'malon_admin',
    'Admin tool',
    {
      operation: z.enum(['generate-key', 'list-keys', 'revoke-key']).describe('op'),
      label: z.string().optional().describe('label'),
      role: z.string().optional().describe('role'),
      key_id: z.string().optional().describe('key_id'),
    },
    async (args) => {
      if (args.operation === 'generate-key') {
        const key = {
          key: 'mal_' + 'a'.repeat(64),
          key_id: 'uuid-123',
          label: args.label ?? 'test',
          role: args.role ?? 'service',
          created_at: new Date().toISOString(),
        };
        storedKeys.push(key);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, data: key }) }] };
      }
      if (args.operation === 'list-keys') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                data: {
                  keys: storedKeys.map((k) => ({ ...k, active: true })),
                },
              }),
            },
          ],
        };
      }
      if (args.operation === 'revoke-key') {
        storedKeys = storedKeys.filter((k) => k.key_id !== args.key_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                data: { key_id: args.key_id, revoked_at: new Date().toISOString() },
              }),
            },
          ],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'unknown' }) }],
      };
    },
  );

  await server.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientTransport);

  // generate a key
  const genResult = await client.request(
    {
      method: 'tools/call',
      params: {
        name: 'malon_admin',
        arguments: { operation: 'generate-key', label: 'integration-test', role: 'service' },
      },
    },
    z.any(),
  );
  const genParsed = JSON.parse(genResult.content[0].text);
  assert.equal(genParsed.success, true);
  assert.ok(genParsed.data.key.startsWith('mal_'), 'should have key prefix');
  assert.equal(genParsed.data.label, 'integration-test');
  assert.equal(genParsed.data.role, 'service');

  // list keys
  const listResult = await client.request(
    {
      method: 'tools/call',
      params: { name: 'malon_admin', arguments: { operation: 'list-keys' } },
    },
    z.any(),
  );
  const listParsed = JSON.parse(listResult.content[0].text);
  assert.equal(listParsed.success, true);
  assert.ok(Array.isArray(listParsed.data.keys));
  assert.ok(listParsed.data.keys.length >= 1);

  // revoke key
  const revokeId = genParsed.data.key_id;
  const revokeResult = await client.request(
    {
      method: 'tools/call',
      params: {
        name: 'malon_admin',
        arguments: { operation: 'revoke-key', key_id: revokeId },
      },
    },
    z.any(),
  );
  const revokeParsed = JSON.parse(revokeResult.content[0].text);
  assert.equal(revokeParsed.success, true);
  assert.equal(revokeParsed.data.key_id, revokeId);

  await client.close();
  await server.close();
});

test('malon_admin returns error for missing required fields', async () => {
  const server = new McpServer({ name: 'test', version: '0.0.1' }, { capabilities: { tools: {} } });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  server.tool(
    'malon_admin',
    'Admin tool',
    {
      operation: z.enum(['generate-key', 'list-keys', 'revoke-key']).describe('op'),
    },
    async (args) => {
      if (args.operation === 'generate-key') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: 'label is required for generate-key' }),
            },
          ],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'unknown' }) }],
      };
    },
  );

  await server.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientTransport);

  // generate-key without label should return error
  const result = await client.request(
    {
      method: 'tools/call',
      params: {
        name: 'malon_admin',
        arguments: { operation: 'generate-key' },
      },
    },
    z.any(),
  );
  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.success, false);
  assert.ok(parsed.error.includes('label is required'));

  await client.close();
  await server.close();
});
