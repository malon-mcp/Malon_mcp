import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeFts5Query } from '../../../dist/search/fts5-sanitize.js';

test('basic query passes through', () => {
  assert.equal(sanitizeFts5Query('jwt validation'), 'jwt validation');
});

test('multi-byte characters preserved', () => {
  const result = sanitizeFts5Query('日本語 検索');
  assert.ok(result.includes('日本語'));
});

test('whitespace normalization', () => {
  assert.equal(sanitizeFts5Query('foo    bar'), 'foo bar');
});

test('FTS5 operator characters stripped', () => {
  assert.equal(sanitizeFts5Query('foo()^*"bar'), 'foo bar');
});

test('control characters preserved through NFKC normalization', () => {
  const result = sanitizeFts5Query('foo\x00bar');
  assert.ok(result.startsWith('foo'));
  assert.ok(result.endsWith('bar'));
});
