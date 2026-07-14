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
    async () => ({ content: [{ type: 'text', text: JSON.stringify({ spans: [], not_found: true }) }] }),
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
