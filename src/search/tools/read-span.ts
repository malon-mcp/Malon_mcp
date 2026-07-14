import { resolveInside } from '../../util/paths.js';
import fs from 'node:fs/promises';

const MAX_BYTES = 8 * 1024;

export interface ReadSpanResult {
  content: string;
}

export async function readSpan(
  repoRoot: string,
  filePath: string,
  startLine: number,
  endLine: number,
): Promise<ReadSpanResult> {
  const resolved = await resolveInside(repoRoot, filePath);
  const text = await fs.readFile(resolved, 'utf8');
  const lines = text.split('\n');
  const selected = lines.slice(startLine - 1, endLine);
  let content = selected.join('\n');
  if (Buffer.byteLength(content, 'utf8') > MAX_BYTES) {
    content = content.slice(0, MAX_BYTES) + '\n… [truncated]';
  }
  return { content };
}
