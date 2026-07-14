import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeFts5Query } from '../../dist/search/fts5-sanitize.js';
import { SanitizedFts5Error } from '../../dist/util/errors.js';

test('sanitizeFts5Query strips FTS5 operators', () => {
  assert.equal(sanitizeFts5Query('(test)'), 'test');
  assert.equal(sanitizeFts5Query('query*'), 'query');
  assert.equal(sanitizeFts5Query('"exact"'), 'exact');
  assert.equal(sanitizeFts5Query('foo:bar'), 'foo bar');
});

test('sanitizeFts5Query strips FTS5 keyword operators', () => {
  assert.equal(sanitizeFts5Query('foo AND bar'), 'foo bar');
  assert.equal(sanitizeFts5Query('foo OR bar'), 'foo bar');
  assert.equal(sanitizeFts5Query('foo NOT bar'), 'foo bar');
  assert.equal(sanitizeFts5Query('NEAR(foo bar)'), 'foo bar');
});

test('sanitizeFts5Query normalizes whitespace', () => {
  assert.equal(sanitizeFts5Query('  foo   bar  '), 'foo bar');
  assert.equal(sanitizeFts5Query('foo\t\nbar'), 'foo bar');
});

test('sanitizeFts5Query caps length at 256', () => {
  const long = 'a'.repeat(300);
  const result = sanitizeFts5Query(long);
  assert.ok(result.length <= 256);
});

test('sanitizeFts5Query rejects empty string', () => {
  assert.throws(() => sanitizeFts5Query(''), SanitizedFts5Error);
});

test('sanitizeFts5Query rejects string with only operators', () => {
  assert.throws(() => sanitizeFts5Query('AND OR NOT'), SanitizedFts5Error);
  assert.throws(() => sanitizeFts5Query('()*'), SanitizedFts5Error);
});

test('sanitizeFts5Query rejects non-string input', () => {
  assert.throws(() => sanitizeFts5Query(undefined), SanitizedFts5Error);
  assert.throws(() => sanitizeFts5Query(123), SanitizedFts5Error);
});
