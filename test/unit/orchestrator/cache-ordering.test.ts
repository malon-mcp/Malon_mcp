import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  orderContext,
  buildContextString,
  createStableItem,
  createDynamicItem,
  type ContextItem,
} from '../../../src/orchestrator/cache-ordering.js';

test('stable items come before dynamic items', () => {
  const items: ContextItem[] = [
    createDynamicItem('query', 'search for JWT'),
    createStableItem('memory', '## Use tree-sitter for parsing'),
    createStableItem('system', 'You are a coding agent'),
    createDynamicItem('file', 'function validate() { ... }'),
  ];

  const result = orderContext(items);

  const kinds = result.items.map((i) => i.stability);
  const firstDynamic = kinds.indexOf('dynamic');
  const lastStable = kinds.lastIndexOf('stable');
  assert.ok(lastStable < firstDynamic, 'all stable items before any dynamic');
});

test('stable items ordered by priority within group', () => {
  const items: ContextItem[] = [
    createStableItem('memory', 'low mem', 10),
    createStableItem('system', 'high sys', 0),
    createStableItem('conventions', 'mid conv', 5),
  ];

  const result = orderContext(items);

  const priorities = result.items.map((i) => i.priority);
  assert.equal(priorities[0], 0);
  assert.equal(priorities[1], 5);
  assert.equal(priorities[2], 10);
});

test('single item returns correctly', () => {
  const item = createStableItem('test', 'content');
  const result = orderContext([item]);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]!.key, 'test');
});

test('empty items list returns empty', () => {
  const result = orderContext([]);
  assert.equal(result.items.length, 0);
  assert.equal(result.totalLength, 0);
});

test('buildContextString concatenates in stable-first order', () => {
  const items: ContextItem[] = [
    createDynamicItem('q', 'search query'),
    createStableItem('m', 'memory content'),
  ];

  const result = buildContextString(items);

  assert.ok(result.startsWith('memory content'));
  assert.ok(result.endsWith('search query'));
});

test('totalLength sums all content lengths', () => {
  const items: ContextItem[] = [
    createStableItem('a', 'hello'),
    createDynamicItem('b', 'world'),
  ];

  const result = orderContext(items);
  assert.equal(result.totalLength, 10);
});

test('createStableItem sets correct defaults', () => {
  const item = createStableItem('k', 'content');
  assert.equal(item.stability, 'stable');
  assert.equal(item.priority, 0);
});

test('createDynamicItem sets correct defaults', () => {
  const item = createDynamicItem('k', 'content');
  assert.equal(item.stability, 'dynamic');
  assert.equal(item.priority, 0);
});
