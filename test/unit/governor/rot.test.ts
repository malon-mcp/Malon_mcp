import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setCeiling, recordFileRead, checkRot, resetRotState } from '../../../src/governor/rot.js';

test('setCeiling sets appropriate ceiling based on repo size', () => {
  // 0.4 * 300_000 = 120_000, min(120_000, 120_000) = 120_000, max(32_000, 120_000) = 120_000
  setCeiling(300_000);
  const rot = checkRot(100_000);
  assert.equal(rot, null);

  // 0.4 * 1_000_000 = 400_000, min(120_000, 400_000) = 120_000
  setCeiling(1_000_000);
  const rotLarge = checkRot(100_000);
  assert.equal(rotLarge, null);
});

test('checkRot trips on context size exceeding ceiling', () => {
  setCeiling(50_000);
  // 0.4 * 50_000 = 20_000, min(120_000, 20_000) = 20_000, max(32_000, 20_000) = 32_000
  const rot = checkRot(33_000);
  assert.equal(rot, 'context_size');
});

test('checkRot trips on file thrashing', () => {
  resetRotState();
  recordFileRead('src/main.ts');
  recordFileRead('src/main.ts');
  const rot = checkRot(1);
  assert.equal(rot, null);
  recordFileRead('src/main.ts');
  const rotTripped = checkRot(1);
  assert.equal(rotTripped, 'file_thrashing');
});

test('resetRotState clears file read counts', () => {
  recordFileRead('src/main.ts');
  recordFileRead('src/main.ts');
  recordFileRead('src/main.ts');
  resetRotState();
  assert.equal(checkRot(1), null);
});
