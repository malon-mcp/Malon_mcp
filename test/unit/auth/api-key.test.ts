import { test } from 'node:test';
import assert from 'node:assert/strict';

test('api-key module', async (t) => {
  await t.test('generateApiKey produces valid key format', async () => {
    const { generateApiKey, validateApiKeyFormat } = await import('../../../src/auth/api-key.js');
    const { raw, record } = generateApiKey('test-key');
    assert.ok(raw.startsWith('mal_'));
    assert.equal(raw.length, 4 + 64);
    assert.ok(validateApiKeyFormat(raw));
    assert.equal(record.label, 'test-key');
    assert.equal(record.role, 'service');
    assert.ok(record.id);
  });

  await t.test('generateApiKey custom role', async () => {
    const { generateApiKey } = await import('../../../src/auth/api-key.js');
    const { record } = generateApiKey('admin-key', 'admin');
    assert.equal(record.role, 'admin');
  });

  await t.test('validateApiKeyFormat rejects invalid keys', async () => {
    const { validateApiKeyFormat } = await import('../../../src/auth/api-key.js');
    assert.equal(validateApiKeyFormat(''), false);
    assert.equal(validateApiKeyFormat('not-mal-prefix'), false);
    assert.equal(validateApiKeyFormat('mal_invalidhex'), false);
    assert.equal(validateApiKeyFormat('mal_' + 'z'.repeat(64)), false);
  });

  await t.test('hashApiKey produces consistent hash', async () => {
    const { hashApiKey } = await import('../../../src/auth/api-key.js');
    const hash1 = hashApiKey('mal_test-key-hex-data-here');
    const hash2 = hashApiKey('mal_test-key-hex-data-here');
    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64);
  });

  await t.test('verifyApiKey matches correctly', async () => {
    const { generateApiKey, verifyApiKey } = await import('../../../src/auth/api-key.js');
    const { raw, record } = generateApiKey('verify-test');
    assert.ok(verifyApiKey(raw, record.key_hash));
    assert.equal(verifyApiKey('mal_wrongkey' + '0'.repeat(58)), false);
  });

  await t.test('isApiKeyActive checks revoked and expired', async () => {
    const { isApiKeyActive } = await import('../../../src/auth/api-key.js');
    const activeKey = {
      id: '1',
      key_hash: 'hash',
      label: 'test',
      role: 'service',
      created_at: new Date().toISOString(),
      expires_at: null,
      revoked_at: null,
      last_used_at: null,
    };
    assert.ok(isApiKeyActive(activeKey));

    const revokedKey = { ...activeKey, revoked_at: new Date().toISOString() };
    assert.equal(isApiKeyActive(revokedKey), false);

    const expiredKey = {
      ...activeKey,
      expires_at: new Date(Date.now() - 10000).toISOString(),
    };
    assert.equal(isApiKeyActive(expiredKey), false);
  });

  await t.test('revokeApiKey sets revoked_at', async () => {
    const { revokeApiKey } = await import('../../../src/auth/api-key.js');
    const record = {
      id: '1',
      key_hash: 'hash',
      label: 'test',
      role: 'service',
      created_at: new Date().toISOString(),
      expires_at: null,
      revoked_at: null,
      last_used_at: null,
    };
    const revoked = revokeApiKey(record);
    assert.ok(revoked.revoked_at);
  });
});
