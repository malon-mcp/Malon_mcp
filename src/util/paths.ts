import path from 'node:path';
import fs from 'node:fs/promises';
import { MalonError } from '../types.js';
import { PathEscapeError } from './errors.js';

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function realpathLenient(rootReal: string, abs: string): Promise<string> {
  let cursor = abs;
  const tail: string[] = [];
  while (cursor !== rootReal && !(await exists(cursor))) {
    tail.unshift(path.basename(cursor));
    cursor = path.dirname(cursor);
  }
  let real = await fs.realpath(cursor);
  for (const piece of tail) real = path.join(real, piece);
  return real;
}

export async function resolveInside(repoRoot: string, requested: string): Promise<string> {
  const rootAbs = path.resolve(repoRoot);
  const requestedAbs = path.isAbsolute(requested)
    ? path.normalize(requested)
    : path.resolve(rootAbs, requested);

  let rootReal: string;
  try {
    rootReal = await fs.realpath(rootAbs);
  } catch {
    throw new MalonError('internal', `Repo root not accessible: ${repoRoot}`);
  }

  const targetReal = await realpathLenient(rootReal, requestedAbs);

  const rel = path.relative(rootReal, targetReal);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new PathEscapeError(requested);
  }

  return targetReal;
}

export async function safeRead(
  repoRoot: string,
  requested: string,
): Promise<string> {
  const resolved = await resolveInside(repoRoot, requested);
  return fs.readFile(resolved, 'utf8');
}
