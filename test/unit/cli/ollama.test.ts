import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkOllamaHealth,
  ensureModelAvailable,
  generateLocalConfig,
  RECOMMENDED_LOCAL_MODELS,
} from '../../../src/cli/ollama.js';

test('checkOllamaHealth returns unavailable on connection error', async () => {
  const result = await checkOllamaHealth('http://127.0.0.1:1', 100);
  assert.equal(result.available, false);
  assert.ok(result.error);
  assert.equal(result.url, 'http://127.0.0.1:1');
});

test('checkOllamaHealth returns available with models', async () => {
  const originalFetch = globalThis.fetch;

  let callCount = 0;
  globalThis.fetch = async (url: RequestInfo | URL) => {
    const urlStr =
      typeof url === 'string' ? url : url instanceof URL ? url.href : (url as Request).url;
    callCount++;
    if (urlStr.includes('/api/tags')) {
      return new Response(
        JSON.stringify({ models: [{ name: 'llama3.1-8b' }, { name: 'mistral-7b' }] }),
        { status: 200 },
      );
    }
    if (urlStr.includes('/api/version')) {
      return new Response(JSON.stringify({ version: '0.1.0' }), { status: 200 });
    }
    return new Response('', { status: 404 });
  };

  try {
    const result = await checkOllamaHealth('http://127.0.0.1:11434', 5000);
    assert.equal(result.available, true);
    assert.deepEqual(result.models, ['llama3.1-8b', 'mistral-7b']);
    assert.equal(result.version, '0.1.0');
    assert.equal(result.url, 'http://127.0.0.1:11434');
    assert.equal(callCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateLocalConfig produces valid config', () => {
  const config = generateLocalConfig('llama3.1-8b');
  assert.ok(config.includes('local:\n  enabled: true'));
  assert.ok(config.includes('provider: ollama'));
  assert.ok(config.includes('model: llama3.1-8b'));
  assert.ok(config.includes('# Malon configuration — local-only mode'));
  assert.ok(config.includes('telemetry:\n  enabled: false'));
});

test('RECOMMENDED_LOCAL_MODELS contains expected entries', () => {
  assert.ok(RECOMMENDED_LOCAL_MODELS.length >= 5);
  const llama = RECOMMENDED_LOCAL_MODELS.find((m) => m.id === 'llama3.1-8b');
  assert.ok(llama);
  assert.equal(llama.minRam, 8);
  assert.ok(llama.description.includes('default'));
});

test('generateLocalConfig uses model name in search config', () => {
  const config = generateLocalConfig('phi3:14b');
  assert.ok(config.includes('model: phi3:14b'));
  assert.ok(config.includes('phi3:14b:\n        input_per_million: 0'));
  assert.ok(config.includes('llama3.1') === false);
  assert.ok(config.includes('ollama_url')); // 'ollama' still appears in URL key
});

test('ensureModelAvailable returns unavailable if Ollama unreachable', async () => {
  const result = await ensureModelAvailable('llama3.1-8b', 'http://127.0.0.1:1', 100);
  assert.equal(result.available, false);
  assert.ok(result.error);
});

test('ensureModelAvailable returns available if model already present', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: RequestInfo | URL) => {
    const urlStr =
      typeof url === 'string' ? url : url instanceof URL ? url.href : (url as Request).url;
    if (urlStr.includes('/api/tags')) {
      return new Response(JSON.stringify({ models: [{ name: 'llama3.1-8b' }] }), { status: 200 });
    }
    return new Response('', { status: 404 });
  };

  try {
    const result = await ensureModelAvailable('llama3.1-8b', 'http://127.0.0.1:11434', 5000);
    assert.equal(result.available, true);
    assert.equal(result.pulled, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ensureModelAvailable tries to pull missing model', async () => {
  const originalFetch = globalThis.fetch;
  let pulled = false;
  globalThis.fetch = async (url: RequestInfo | URL) => {
    const urlStr =
      typeof url === 'string' ? url : url instanceof URL ? url.href : (url as Request).url;
    if (urlStr.includes('/api/tags')) {
      return new Response(JSON.stringify({ models: [] }), { status: 200 });
    }
    if (urlStr.includes('/api/pull')) {
      pulled = true;
      return new Response(JSON.stringify({ status: 'success' }), { status: 200 });
    }
    return new Response('', { status: 404 });
  };

  try {
    const result = await ensureModelAvailable('llama3.1-8b', 'http://127.0.0.1:11434', 5000);
    assert.equal(result.available, true);
    assert.equal(result.pulled, true);
    assert.ok(pulled);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
