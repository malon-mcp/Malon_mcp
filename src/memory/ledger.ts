import path from 'node:path';
import fs from 'node:fs/promises';
import { MalonError } from '../types.js';
import { resolveInside } from '../util/paths.js';
import { scanForSecrets } from './secret-scan.js';
import { logger } from '../util/log.js';

const MEMORY_DIR = '.malon/memory';

function memoryDir(repoRoot: string): string {
  return path.resolve(repoRoot, MEMORY_DIR);
}

const CATEGORY_FILES: Record<string, string> = {
  decisions: 'decisions.md',
  conventions: 'conventions.md',
  rejected: 'rejected.md',
  session: 'sessions',
};

export async function writeMemory(
  repoRoot: string,
  category: string,
  heading: string,
  body: string,
): Promise<string> {
  const memDir = memoryDir(repoRoot);

  const catFile = CATEGORY_FILES[category];
  if (!catFile) {
    throw new MalonError('config', `Unknown memory category: ${category}`);
  }

  scanForSecrets(heading + '\n' + body);

  const entry = `\n## ${heading}\n${body}\n`;
  const targetPath =
    category === 'session'
      ? path.join(memDir, 'sessions', `${Date.now()}.md`)
      : path.join(memDir, catFile);

  const resolved = await resolveInside(memDir, path.relative(memDir, targetPath));
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.appendFile(resolved, entry, 'utf8');

  logger.debug({ path: resolved, category }, 'memory_written');
  return resolved;
}

export async function getMemory(repoRoot: string, query?: string): Promise<string> {
  const memDir = memoryDir(repoRoot);
  const entries: string[] = [];

  for (const file of Object.values(CATEGORY_FILES)) {
    const fp = file === 'sessions' ? path.join(memDir, 'sessions') : path.join(memDir, file);
    try {
      const resolved = await resolveInside(repoRoot, path.relative(repoRoot, fp));
      const stat = await fs.stat(resolved);
      if (stat.isDirectory()) {
        const files = await fs.readdir(resolved);
        files.sort().reverse();
        for (const f of files.slice(0, 5)) {
          const content = await fs.readFile(path.join(resolved, f), 'utf8');
          const section = `# session: ${f}\n${content}`;
          if (!query || section.toLowerCase().includes(query.toLowerCase())) {
            entries.push(section);
          }
        }
      } else {
        const content = await fs.readFile(resolved, 'utf8');
        const section = `# ${file}\n${content}`;
        if (!query || section.toLowerCase().includes(query.toLowerCase())) {
          entries.push(section);
        }
      }
    } catch {
      // File doesn't exist yet
    }
  }

  return entries.join('\n---\n');
}

export async function getMemorySummary(repoRoot: string): Promise<string> {
  const memDir = memoryDir(repoRoot);
  const summaries: string[] = [];

  for (const [category, file] of Object.entries(CATEGORY_FILES)) {
    const fp = file === 'sessions' ? path.join(memDir, 'sessions') : path.join(memDir, file);
    try {
      const resolved = await resolveInside(repoRoot, path.relative(repoRoot, fp));
      const stat = await fs.stat(resolved);
      if (stat.isDirectory()) {
        const files = await fs.readdir(resolved);
        files.sort().reverse();
        const recent = files.slice(0, 3);
        if (recent.length > 0) {
          summaries.push(`${category} (${recent.length} recent)`);
        }
      } else {
        const content = await fs.readFile(resolved, 'utf8');
        const headingCount = (content.match(/^## /gm) ?? []).length;
        if (headingCount > 0) {
          summaries.push(`${category}: ${headingCount} entries`);
        }
      }
    } catch {
      // File doesn't exist yet
    }
  }

  if (summaries.length === 0) return 'No memory entries yet.';
  return 'Memory: ' + summaries.join(', ') + '.';
}
