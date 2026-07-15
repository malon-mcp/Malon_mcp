import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { generateBenchFixture } from '../../scripts/generate-bench-fixture.js';

const BUDGETS = {
  fullIndex_50files: 5_000,
  fullIndex_100files: 15_000,
  incrementalIndex_10files: 3_000,
  statusResponse: 100,
  fts5Query: 100,
  pathResolution: 5,
} as const;

interface BenchResult {
  name: string;
  actualMs: number;
  budgetMs: number;
  passed: boolean;
  iterations: number;
  timestamp: string;
}

const results: BenchResult[] = [];

function record(name: string, actualMs: number, budgetMs: number, iterations = 1): void {
  results.push({
    name,
    actualMs: Math.round(actualMs * 100) / 100,
    budgetMs,
    passed: actualMs <= budgetMs,
    iterations,
    timestamp: new Date().toISOString(),
  });
}

function closeDbSafely(d: unknown): void {
  try {
    const db = d as { close: () => void; pragma: (s: string) => unknown };
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
  } catch {
    /* best-effort */
  }
}

async function cleanDir(dir: string, ...closeFns: (() => void)[]): Promise<void> {
  for (const fn of closeFns) {
    try {
      fn();
    } catch {
      /* best-effort */
    }
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === 'EBUSY' && attempt < 9) {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      throw err;
    }
  }
}

test('bench: full re-index of 50-file fixture', { timeout: 30_000 }, async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'malon-bench-'));
  let db: unknown = null;
  try {
    await generateBenchFixture(tempDir, 50);
    const mod = await import('../../src/index/index.js');
    const dbPath = path.join(tempDir, '.malon', 'bench.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    mod.initIndex(dbPath, tempDir);
    db = mod.getDb();

    const start = performance.now();
    const result = await mod.indexRepo(tempDir);
    const elapsed = performance.now() - start;

    console.log(`  Indexed ${result.files_indexed} files in ${elapsed.toFixed(1)}ms`);
    assert.equal(result.files_indexed, 50);
    record('fullIndex_50files', elapsed, BUDGETS.fullIndex_50files);
    if (elapsed > BUDGETS.fullIndex_50files) {
      console.log(`  ⚠ Budget exceeded: ${elapsed.toFixed(1)}ms > ${BUDGETS.fullIndex_50files}ms`);
    }
  } finally {
    await cleanDir(tempDir, () => closeDbSafely(db));
  }
});

test('bench: full re-index of 100-file fixture (scaled)', { timeout: 60_000 }, async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'malon-bench-'));
  let db: unknown = null;
  try {
    await generateBenchFixture(tempDir, 100);
    const mod = await import('../../src/index/index.js');
    const dbPath = path.join(tempDir, '.malon', 'bench-large.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    mod.initIndex(dbPath, tempDir);
    db = mod.getDb();

    const start = performance.now();
    const result = await mod.indexRepo(tempDir);
    const elapsed = performance.now() - start;

    console.log(`  Indexed ${result.files_indexed} files in ${elapsed.toFixed(1)}ms`);
    assert.equal(result.files_indexed, 100);
    record('fullIndex_100files', elapsed, BUDGETS.fullIndex_100files);
  } finally {
    await cleanDir(tempDir, () => closeDbSafely(db));
  }
});

test('bench: re-index 10 files via indexFile', { timeout: 30_000 }, async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'malon-bench-'));
  let db: unknown = null;
  try {
    await generateBenchFixture(tempDir, 50);
    const mod = await import('../../src/index/index.js');
    const dbPath = path.join(tempDir, '.malon', 'bench-incr.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    mod.initIndex(dbPath, tempDir);
    db = mod.getDb();
    await mod.indexRepo(tempDir);

    const srcDir = path.join(tempDir, 'src');
    const { readdir } = await import('node:fs/promises');
    const entries = (await readdir(srcDir)).filter((e) => e.endsWith('.ts'));
    const toModify = entries.slice(0, 10);
    const paths: string[] = [];
    for (const f of toModify) {
      const fp = path.join(srcDir, f);
      const content = await readFile(fp, 'utf8');
      await writeFile(fp, content + '\n// modified\n');
      paths.push(fp);
    }

    const start = performance.now();
    for (const fp of paths) {
      await mod.indexFile(fp);
    }
    const elapsed = performance.now() - start;

    console.log(`  Re-indexed ${paths.length} files in ${elapsed.toFixed(1)}ms`);
    record('incrementalIndex_10files', elapsed, BUDGETS.incrementalIndex_10files);
  } finally {
    await cleanDir(tempDir, () => closeDbSafely(db));
  }
});

test('bench: malon_status response time', { timeout: 15_000 }, async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'malon-bench-'));
  let db: unknown = null;
  try {
    await generateBenchFixture(tempDir, 50);
    const mod = await import('../../src/index/index.js');
    const dbPath = path.join(tempDir, '.malon', 'bench-status.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    mod.initIndex(dbPath, tempDir);
    db = mod.getDb();
    await mod.indexRepo(tempDir);

    const { statusCommand } = await import('../../src/cli/status.js');

    const iterations = 5;
    const samples: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await statusCommand(tempDir);
      samples.push(performance.now() - start);
    }

    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    console.log(`  Status response: avg ${avg.toFixed(1)}ms over ${iterations} calls`);
    record('statusResponse', avg, BUDGETS.statusResponse, iterations);
  } finally {
    await cleanDir(tempDir, () => closeDbSafely(db));
  }
});

test('bench: FTS5 query latency', { timeout: 15_000 }, async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'malon-bench-'));
  let db: unknown = null;
  try {
    await generateBenchFixture(tempDir, 50);
    const mod = await import('../../src/index/index.js');
    const dbPath = path.join(tempDir, '.malon', 'bench-fts5.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    mod.initIndex(dbPath, tempDir);
    db = mod.getDb();
    await mod.indexRepo(tempDir);

    const queries = ['service', 'validate', 'manager', 'config', 'format'];
    const samples: number[] = [];
    for (const q of queries) {
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        (db as { prepare: (s: string) => { get: (...args: unknown[]) => unknown } })
          .prepare('SELECT count(*) as cnt FROM content_fts WHERE content_fts MATCH ?')
          .get(q);
        samples.push(performance.now() - start);
      }
    }

    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    console.log(`  FTS5 query: avg ${avg.toFixed(2)}ms over ${samples.length} runs`);
    record('fts5Query', avg, BUDGETS.fts5Query, samples.length);
  } finally {
    await cleanDir(tempDir, () => closeDbSafely(db));
  }
});

test('bench: path resolution throughput', { timeout: 10_000 }, async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'malon-bench-'));
  try {
    await mkdir(path.join(tempDir, 'a', 'b', 'c'), { recursive: true });
    await writeFile(path.join(tempDir, 'a', 'b', 'c', 'target.txt'), 'data');
    await writeFile(path.join(tempDir, 'safe.txt'), 'data');

    const { resolveInside } = await import('../../src/util/paths.js');

    const iterations = 100;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      await resolveInside(tempDir, 'a/b/c/target.txt');
    }
    const elapsed = performance.now() - start;
    const avg = elapsed / iterations;

    console.log(`  Path resolution: avg ${avg.toFixed(3)}ms over ${iterations} iterations`);
    record('pathResolution', avg, BUDGETS.pathResolution, iterations);
  } finally {
    await cleanDir(tempDir);
  }
});

after(async () => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const benchmarksDir = path.resolve(currentDir, '../../benchmarks/history');
  await mkdir(benchmarksDir, { recursive: true });

  const dateStr = new Date().toISOString().split('T')[0];
  const historyPath = path.join(benchmarksDir, `${dateStr}.json`);
  const summary = {
    date: dateStr,
    results,
    summary: Object.fromEntries(
      results.map((r) => [
        r.name,
        { actualMs: r.actualMs, budgetMs: r.budgetMs, passed: r.passed },
      ]),
    ),
  };

  await writeFile(historyPath, JSON.stringify(summary, null, 2));
  console.log(`\nBenchmark results written to ${historyPath}`);
});
