import { logger } from '../util/log.js';

const SESSION_FILE_READ_CAP = 3;
const MIN_CEILING_TOKENS = 32_000;
const MAX_CEILING_TOKENS = 120_000;
const CEILING_RATIO = 0.4;

interface RotState {
  fileReadCounts: Map<string, number>;
  ceilingTokens: number;
  lastCheckpointMs: number;
}

const state: RotState = {
  fileReadCounts: new Map(),
  ceilingTokens: MIN_CEILING_TOKENS,
  lastCheckpointMs: 0,
};

export function setCeiling(totalRepoTokens: number): void {
  state.ceilingTokens = Math.max(
    MIN_CEILING_TOKENS,
    Math.min(MAX_CEILING_TOKENS, CEILING_RATIO * totalRepoTokens),
  );
}

export function recordFileRead(filePath: string): number {
  const count = (state.fileReadCounts.get(filePath) ?? 0) + 1;
  state.fileReadCounts.set(filePath, count);
  return count;
}

export function checkRot(contextTokens: number): string | null {
  if (contextTokens > state.ceilingTokens) {
    return 'context_size';
  }

  for (const [, count] of state.fileReadCounts) {
    if (count >= SESSION_FILE_READ_CAP) {
      return 'file_thrashing';
    }
  }

  return null;
}

export async function createCheckpoint(
  repoRoot: string,
  cause: string,
  contextTokens: number,
): Promise<string | null> {
  const now = Date.now();
  const cooldownMs = 60_000;
  if (now - state.lastCheckpointMs < cooldownMs) {
    logger.debug({ cause }, 'rot_checkpoint_skipped_cooldown');
    return null;
  }

  const fileReadEntries = [...state.fileReadCounts.entries()]
    .filter(([_, c]) => c >= 2)
    .map(([f, c]) => `  ${f}: ${c} reads`)
    .join('\n');

  const timestamp = new Date().toISOString();
  const summary = `## Session: Rot checkpoint (${cause})
- **Context tokens**: ${contextTokens} (ceiling: ${state.ceilingTokens})
- **Cause**: ${cause}
- **Timestamp**: ${timestamp}
- **Frequently re-read files**:
${fileReadEntries || '  none'}
- **Recommendation**: Context quality is dropping. Start a fresh session. Your progress is saved in this file.`;

  const { writeMemory } = await import('../memory/ledger.js');
  const path = await writeMemory(
    repoRoot,
    'session',
    `Checkpoint: ${cause} at ${timestamp}`,
    summary,
  );
  state.lastCheckpointMs = now;
  logger.info({ cause, path, contextTokens }, 'rot_checkpoint_created');
  return path;
}

export function resetRotState(): void {
  state.fileReadCounts.clear();
}

export interface RotCheckpoint {
  timestamp: string;
  cause: string;
  contextTokens: number;
  summary: Record<string, unknown>;
}
