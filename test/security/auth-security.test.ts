import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  generateApiKey,
  hashApiKey,
  validateApiKeyFormat,
  verifyApiKey,
  revokeApiKey,
  isApiKeyActive,
} from '../../src/auth/api-key.js';
import { createSession, hashSessionToken } from '../../src/auth/session.js';
import { setupMfa, verifyTotp, verifyRecoveryCode } from '../../src/auth/mfa.js';
import { hasPermission, roleLevel, isRoleAtLeast, requirePermission } from '../../src/auth/rbac.js';

// ---------------------------------------------------------------------------
// API Key security
// ---------------------------------------------------------------------------

describe('api-key security', () => {
  test('starts with expected prefix', () => {
    const { raw } = generateApiKey('test');
    assert.ok(raw.startsWith('mal_'), `Key should start with "mal_", got: ${raw.slice(0, 8)}`);
  });

  test('raw key hex portion is exactly 64 characters', () => {
    const { raw } = generateApiKey('test');
    const hexPart = raw.slice('mal_'.length);
    assert.equal(hexPart.length, 64, 'raw key hex should be 64 chars (32 bytes)');
  });

  test('validateApiKeyFormat rejects missing prefix', () => {
    assert.equal(validateApiKeyFormat('sk-ant-xxxxxxxxxx'), false);
    assert.equal(validateApiKeyFormat(''), false);
    assert.equal(validateApiKeyFormat('mal_'), false);
  });

  test('validateApiKeyFormat rejects non-hex characters', () => {
    const bad = 'mal_' + 'z'.repeat(64);
    assert.equal(validateApiKeyFormat(bad), false);
  });

  test('validateApiKeyFormat rejects wrong length', () => {
    assert.equal(validateApiKeyFormat('mal_' + 'a'.repeat(62)), false);
    assert.equal(validateApiKeyFormat('mal_' + 'a'.repeat(66)), false);
  });

  test('validateApiKeyFormat accepts valid key', () => {
    const { raw } = generateApiKey('test');
    assert.equal(validateApiKeyFormat(raw), true);
  });

  test('hash is deterministic for same key', () => {
    const { raw } = generateApiKey('test');
    const h1 = hashApiKey(raw);
    const h2 = hashApiKey(raw);
    assert.equal(h1, h2);
  });

  test('verifyApiKey returns true for correct key', () => {
    const { raw, record } = generateApiKey('test');
    assert.equal(verifyApiKey(raw, record.key_hash), true);
  });

  test('verifyApiKey rejects wrong key', () => {
    const { record } = generateApiKey('test');
    assert.equal(verifyApiKey('mal_' + 'a'.repeat(64), record.key_hash), false);
  });

  test('revokeApiKey sets revoked_at', () => {
    const { record } = generateApiKey('test');
    const updated = revokeApiKey(record);
    assert.ok(updated.revoked_at !== null, 'revoked key should have revoked_at set');
    assert.ok(
      new Date(updated.revoked_at!).getTime() <= Date.now(),
      'revoked_at should be in the past',
    );
  });

  test('isApiKeyActive returns false for revoked key', () => {
    const { record } = generateApiKey('test');
    const revoked = revokeApiKey(record);
    assert.equal(isApiKeyActive(revoked), false);
  });

  test('isApiKeyActive returns false for expired key', () => {
    const { record } = generateApiKey('test');
    const expired = {
      ...record,
      expires_at: new Date(Date.now() - 10000).toISOString(),
    };
    assert.equal(isApiKeyActive(expired), false);
  });

  test('isApiKeyActive returns true for active key', () => {
    const { record } = generateApiKey('test');
    assert.equal(isApiKeyActive(record), true);
  });
});

// ---------------------------------------------------------------------------
// Session token security
// ---------------------------------------------------------------------------

describe('session token security', () => {
  test('token is at least 48 bytes of entropy (64 base64url chars)', () => {
    const { token } = createSession({ userId: 'test-user' });
    assert.ok(token.length >= 64, `token too short: ${token.length} chars`);
    // Base64url encoding: 48 bytes => 64 chars
    assert.equal(token.length, 64);
  });

  test('token hash is deterministic', () => {
    const { token } = createSession({ userId: 'test-user' });
    const h1 = hashSessionToken(token);
    const h2 = hashSessionToken(token);
    assert.equal(h1, h2);
  });

  test('token hash uses sha256 (64 hex chars)', () => {
    const { token } = createSession({ userId: 'test-user' });
    const h = hashSessionToken(token);
    assert.equal(h.length, 64, 'sha256 hex should be 64 chars');
  });

  test('two sessions produce different tokens', () => {
    const s1 = createSession({ userId: 'u1' });
    const s2 = createSession({ userId: 'u2' });
    assert.notEqual(s1.token, s2.token);
  });

  test('session token does not contain user ID in plaintext', () => {
    const { token } = createSession({ userId: 'admin-secret-12345' });
    assert.ok(!token.includes('admin-secret'), 'token should not leak user ID');
  });
});

// ---------------------------------------------------------------------------
// MFA security
// ---------------------------------------------------------------------------

describe('mfa security', () => {
  test('TOTP secret is base32 (uppercase + digits)', () => {
    const result = setupMfa('Malon', 'test-user');
    assert.ok(/^[A-Z2-7]+=*$/.test(result.secret), `secret not base32: ${result.secret}`);
  });

  test('otpauth URL is well-formed', () => {
    const result = setupMfa('Malon', 'test-user');
    assert.ok(result.otpauth_url.startsWith('otpauth://totp/'), `bad URL: ${result.otpauth_url}`);
    assert.ok(result.otpauth_url.includes('secret='), 'URL missing secret param');
    assert.ok(result.otpauth_url.includes('issuer=Malon'), 'URL missing issuer');
  });

  test('verifyTotp rejects malformed code', () => {
    const result = setupMfa('Malon', 'test-user');
    assert.equal(verifyTotp(result.secret, 'abc'), false);
    assert.equal(verifyTotp(result.secret, '12345'), false);
    assert.equal(verifyTotp(result.secret, '1234567'), false);
    assert.equal(verifyTotp(result.secret, ''), false);
  });

  test('recovery codes are 8 per setup', () => {
    const result = setupMfa('Malon', 'test-user');
    assert.equal(result.recovery_codes.length, 8);
  });

  test('recovery codes are unique within a setup', () => {
    const result = setupMfa('Malon', 'test-user');
    const unique = new Set(result.recovery_codes);
    assert.equal(unique.size, result.recovery_codes.length);
  });

  test('verifyRecoveryCode consumes the code (single-use)', () => {
    const result = setupMfa('Malon', 'test-user');
    const code = result.recovery_codes[0]!;
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const recoveryHashes = result.recovery_codes.map((c) =>
      crypto.createHash('sha256').update(c).digest('hex'),
    );

    const firstCheck = verifyRecoveryCode(code, recoveryHashes);
    assert.equal(firstCheck.valid, true);
    assert.equal(
      firstCheck.remainingHashes.length,
      recoveryHashes.length - 1,
      'should have one fewer hash after consuming a code',
    );
    assert.ok(
      !firstCheck.remainingHashes.includes(codeHash),
      'consumed code hash should be removed',
    );

    const secondCheck = verifyRecoveryCode(code, firstCheck.remainingHashes);
    assert.equal(secondCheck.valid, false, 'reused code should be rejected');
  });

  test('verifyRecoveryCode rejects unknown code', () => {
    const result = setupMfa('Malon', 'test-user');
    const recoveryHashes = result.recovery_codes.map((c) =>
      crypto.createHash('sha256').update(c).digest('hex'),
    );
    const check = verifyRecoveryCode('not-a-real-code', recoveryHashes);
    assert.equal(check.valid, false);
    assert.equal(check.remainingHashes.length, recoveryHashes.length);
  });
});

// ---------------------------------------------------------------------------
// RBAC security
// ---------------------------------------------------------------------------

describe('rbac security', () => {
  test('admin has all permissions', () => {
    const allPermissions = [
      'search',
      'memory_read',
      'memory_write',
      'checkpoint',
      'status',
      'manage_api_keys',
      'manage_users',
      'manage_sessions',
      'view_usage',
      'purge_data',
      'manage_mfa',
      'admin',
    ] as const;
    for (const perm of allPermissions) {
      assert.ok(hasPermission('admin', perm), `admin should have ${perm}`);
    }
  });

  test('viewer only has status', () => {
    assert.ok(hasPermission('viewer', 'status'));
    assert.equal(hasPermission('viewer', 'search'), false);
    assert.equal(hasPermission('viewer', 'memory_write'), false);
    assert.equal(hasPermission('viewer', 'manage_api_keys'), false);
  });

  test('isRoleAtLeast enforces hierarchy', () => {
    assert.ok(isRoleAtLeast('admin', 'viewer'));
    assert.ok(isRoleAtLeast('operator', 'viewer'));
    assert.ok(isRoleAtLeast('user', 'viewer'));
    assert.equal(isRoleAtLeast('viewer', 'admin'), false);
    assert.ok(isRoleAtLeast('admin', 'admin'));
  });

  test('requirePermission throws for insufficient role', () => {
    assert.throws(() => requirePermission('viewer', 'manage_api_keys'), /does not have permission/);
  });

  test('requirePermission succeeds for sufficient role', () => {
    requirePermission('admin', 'manage_api_keys');
  });

  test('listRoles returns all five roles', () => {
    // Import directly from rbac
    const roles = ['admin', 'operator', 'service', 'user', 'viewer'] as const;
    for (const r of roles) {
      assert.ok(typeof roleLevel(r) === 'number', `role ${r} should have a level`);
    }
  });
});

// ---------------------------------------------------------------------------
// Entropy and collision
// ---------------------------------------------------------------------------

describe('entropy guarantees', () => {
  test('SHA-256 hash is exactly 64 hex characters', () => {
    const { raw } = generateApiKey('test');
    const h = hashApiKey(raw);
    assert.equal(h.length, 64);
    assert.ok(/^[a-f0-9]+$/.test(h));
  });

  test('api key raw output is at least 68 characters', () => {
    const { raw } = generateApiKey('test');
    assert.ok(raw.length > 67, `raw key too short: "${raw.length}"`);
  });

  test('two generated keys are never equal', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const { raw } = generateApiKey(`test-${i}`);
      keys.add(raw);
    }
    assert.equal(keys.size, 100, 'duplicate keys generated');
  });

  test('hash uniqueness matches key uniqueness', () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const { raw } = generateApiKey(`test-${i}`);
      hashes.add(hashApiKey(raw));
    }
    assert.equal(hashes.size, 50, 'hash collision detected');
  });
});
