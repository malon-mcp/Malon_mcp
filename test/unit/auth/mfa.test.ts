import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

test('mfa module', async (t) => {
  await t.test('setupMfa generates secret and recovery codes', async () => {
    const { setupMfa } = await import('../../../src/auth/mfa.js');
    const result = setupMfa('Malon', 'test@example.com');
    assert.ok(result.secret.length > 10);
    assert.ok(result.otpauth_url.startsWith('otpauth://totp/'));
    assert.ok(result.otpauth_url.includes('Malon'));
    assert.ok(result.otpauth_url.includes(encodeURIComponent('test@example.com')));
    assert.equal(result.recovery_codes.length, 8);
    for (const code of result.recovery_codes) {
      assert.equal(code.length, 20);
      assert.ok(/^[a-f0-9]+$/.test(code));
    }
  });

  await t.test('setupMfa produces unique secrets per call', async () => {
    const { setupMfa } = await import('../../../src/auth/mfa.js');
    const a = setupMfa('Malon', 'u1@example.com');
    const b = setupMfa('Malon', 'u2@example.com');
    assert.notEqual(a.secret, b.secret);
  });

  await t.test('verifyTotp rejects invalid format', async () => {
    const { verifyTotp } = await import('../../../src/auth/mfa.js');
    assert.equal(verifyTotp('JBSWY3DPEHPK3PXP', 'abc'), false);
    assert.equal(verifyTotp('JBSWY3DPEHPK3PXP', '12345'), false);
    assert.equal(verifyTotp('JBSWY3DPEHPK3PXP', '1234567'), false);
    assert.equal(verifyTotp('JBSWY3DPEHPK3PXP', ''), false);
    assert.equal(verifyTotp('', '123456'), false);
  });

  await t.test('verifyRecoveryCode validates and consumes codes', async () => {
    const { setupMfa, verifyRecoveryCode } = await import('../../../src/auth/mfa.js');
    const result = setupMfa('Malon', 'recovery@example.com');
    const code = result.recovery_codes[0]!;

    const againstWrong = verifyRecoveryCode(code, []);
    assert.equal(againstWrong.valid, false);

    const hashes = result.recovery_codes.map((c) =>
      crypto.createHash('sha256').update(c).digest('hex'),
    );

    const validCheck = verifyRecoveryCode(code, hashes);
    assert.ok(validCheck.valid);
    assert.equal(validCheck.remainingHashes.length, hashes.length - 1);
    assert.ok(!validCheck.remainingHashes.includes(hashes[0]!));
  });

  await t.test('verifyRecoveryCode one code can only be used once', async () => {
    const { setupMfa, verifyRecoveryCode } = await import('../../../src/auth/mfa.js');
    const result = setupMfa('Malon', 'once@example.com');
    const code = result.recovery_codes[0]!;
    const hashes = result.recovery_codes.map((c) =>
      crypto.createHash('sha256').update(c).digest('hex'),
    );

    const first = verifyRecoveryCode(code, hashes);
    assert.ok(first.valid);

    const second = verifyRecoveryCode(code, first.remainingHashes);
    assert.equal(second.valid, false);
  });
});
