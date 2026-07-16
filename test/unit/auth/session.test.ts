import { test } from 'node:test';
import assert from 'node:assert/strict';

test('session module', async (t) => {
  await t.test('createSession generates valid token and record', async () => {
    const { createSession } = await import('../../../src/auth/session.js');
    const { token, record } = createSession({
      userId: 'user-1',
      role: 'admin',
      metadata: { ip: '127.0.0.1' },
    });
    assert.ok(token.length > 40);
    assert.equal(record.user_id, 'user-1');
    assert.equal(record.role, 'admin');
    assert.equal(record.metadata['ip'], '127.0.0.1');
    assert.ok(record.expires_at > record.created_at);
  });

  await t.test('createSession default role is user', async () => {
    const { createSession } = await import('../../../src/auth/session.js');
    const { record } = createSession({ userId: 'user-2' });
    assert.equal(record.role, 'user');
  });

  await t.test('isSessionExpired detects expired sessions', async () => {
    const { createSession, isSessionExpired } = await import('../../../src/auth/session.js');
    const { record } = createSession({ userId: 'user-3', ttlMs: -1000 });
    assert.ok(isSessionExpired(record));
  });

  await t.test('isSessionExpired returns false for valid sessions', async () => {
    const { createSession, isSessionExpired } = await import('../../../src/auth/session.js');
    const { record } = createSession({ userId: 'user-4', ttlMs: 60_000 });
    assert.equal(isSessionExpired(record), false);
  });

  await t.test('refreshSession extends expiry', async () => {
    const { createSession, refreshSession, isSessionExpired } =
      await import('../../../src/auth/session.js');
    const { record } = createSession({ userId: 'user-5', ttlMs: -1000 });
    assert.ok(isSessionExpired(record));
    const refreshed = refreshSession(record, 60_000);
    assert.equal(isSessionExpired(refreshed), false);
    assert.ok(refreshed.refreshed_at);
  });

  await t.test('getRemainingTtlMs returns non-negative value', async () => {
    const { createSession, getRemainingTtlMs } = await import('../../../src/auth/session.js');
    const { record } = createSession({ userId: 'user-6', ttlMs: 60_000 });
    const remaining = getRemainingTtlMs(record);
    assert.ok(remaining > 0);
    assert.ok(remaining <= 60_000);
  });

  await t.test('getRemainingTtlMs returns 0 for expired session', async () => {
    const { createSession, getRemainingTtlMs } = await import('../../../src/auth/session.js');
    const { record } = createSession({ userId: 'user-7', ttlMs: -1000 });
    assert.equal(getRemainingTtlMs(record), 0);
  });
});
