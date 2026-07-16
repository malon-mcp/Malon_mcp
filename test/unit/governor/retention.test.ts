import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';

test('retention module', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'malon-retention-'));
  const logPath = path.join(dir, '.malon', 'usage.log');

  t.afterEach(async () => {
    try {
      await rm(dir, { recursive: true });
    } catch {}
  });

  await t.test('pruneUsageLog deletes old records', async () => {
    const { setRetentionConfig, pruneUsageLog } =
      await import('../../../src/governor/retention.js');
    setRetentionConfig({ usage_log_max_age_days: 1 });

    const oldDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date().toISOString();

    const logContent =
      [
        JSON.stringify({ timestamp: oldDate, query: 'old', input_tokens: 100 }),
        JSON.stringify({ timestamp: recentDate, query: 'recent', input_tokens: 200 }),
      ].join('\n') + '\n';

    await fs.mkdir(path.join(dir, '.malon'), { recursive: true });
    await writeFile(logPath, logContent);

    const result = await pruneUsageLog(dir);
    assert.equal(result.deleted, 1);
    assert.equal(result.kept, 1);

    const remaining = await readFile(logPath, 'utf8');
    assert.ok(remaining.includes('recent'));
    assert.ok(!remaining.includes('old'));
  });

  await t.test('pruneUsageLog handles empty log', async () => {
    const { pruneUsageLog } = await import('../../../src/governor/retention.js');
    const result = await pruneUsageLog(dir);
    assert.equal(result.deleted, 0);
    assert.equal(result.kept, 0);
  });

  await t.test('pruneUsageLog handles malformed lines', async () => {
    const { setRetentionConfig, pruneUsageLog } =
      await import('../../../src/governor/retention.js');
    setRetentionConfig({ usage_log_max_age_days: 30 });

    await fs.mkdir(path.join(dir, '.malon'), { recursive: true });
    await writeFile(
      logPath,
      'not-json\n{"timestamp":"' + new Date().toISOString() + '","valid":true}\n',
    );

    const result = await pruneUsageLog(dir);
    assert.equal(result.kept, 2);
    assert.equal(result.deleted, 0);
  });

  await t.test('purgeUsageLog clears all data', async () => {
    const { purgeUsageLog } = await import('../../../src/governor/retention.js');
    await fs.mkdir(path.join(dir, '.malon'), { recursive: true });
    await writeFile(logPath, '{"test":true}\n');
    await purgeUsageLog(dir);
    const content = await readFile(logPath, 'utf8');
    assert.equal(content, '');
  });

  await t.test('getUsageLogStats returns correct stats', async () => {
    const { getUsageLogStats, setRetentionConfig } =
      await import('../../../src/governor/retention.js');
    setRetentionConfig({ usage_log_max_age_days: 30 });

    await fs.mkdir(path.join(dir, '.malon'), { recursive: true });
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString();
    await writeFile(
      logPath,
      [
        JSON.stringify({ timestamp: old, query: 'old' }),
        JSON.stringify({ timestamp: now, query: 'new' }),
      ].join('\n') + '\n',
    );

    const stats = await getUsageLogStats(dir);
    assert.equal(stats.record_count, 2);
    assert.equal(stats.oldest_record, old);
    assert.equal(stats.newest_record, now);
    assert.ok(stats.size_bytes > 0);
  });
});
