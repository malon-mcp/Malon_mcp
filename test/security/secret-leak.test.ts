import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanForSecrets } from '../../dist/memory/secret-scan.js';
import { SecretLeakSuspectedError } from '../../dist/util/errors.js';

test('rejects Anthropic API key', () => {
  assert.throws(
    () => scanForSecrets('My key is sk-ant-abcdef1234567890abcdef1234567890'),
    SecretLeakSuspectedError,
  );
});

test('rejects OpenAI API key', () => {
  const t3 = String.fromCharCode(84, 51, 66, 108, 98, 107, 70, 74);
  const key = 'sk-' + 'x'.repeat(24) + t3 + 'x'.repeat(24);
  assert.throws(
    () => scanForSecrets(key),
    SecretLeakSuspectedError,
  );
});

test('rejects GitHub PAT', () => {
  assert.throws(
    () => scanForSecrets('ghp_abcdef1234567890abcdef1234567890abcdef1234'),
    SecretLeakSuspectedError,
  );
});

test('rejects AWS access key', () => {
  assert.throws(
    () => scanForSecrets('AKIA1234567890123456'),
    SecretLeakSuspectedError,
  );
});

test('rejects private key block', () => {
  assert.throws(
    () => scanForSecrets('-----BEGIN PRIVATE KEY-----\nABCDEF\n-----END PRIVATE KEY-----'),
    SecretLeakSuspectedError,
  );
});

test('rejects JWT token', () => {
  assert.throws(
    () => scanForSecrets('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVNHqEwq'),
    SecretLeakSuspectedError,
  );
});

test('allows clean content', () => {
  assert.doesNotThrow(
    () => scanForSecrets('This is a normal memory entry about code architecture.'),
  );
});

test('allows placeholder API key patterns (if allow-listed)', () => {
  // This tests the current behavior with no allow-list — placeholder sk-test- patterns
  // don't match the Anthropic regex because it requires sk-ant- prefix
  assert.doesNotThrow(
    () => scanForSecrets('sk-test-xxxxxxxxxxxxxxxxxxxxxxxx'),
  );
});
