import { logger } from '../util/log.js';

const SESSION_FILE_READ_CAP = 3;
const MIN_CEILING_TOKENS = 32_000;
const MAX_CEILING_TOKENS = 120_000;
const CEILING_RATIO = 0.4;

interface RotState {
  fileReadCounts: Map<string, number>;
  ceilingTokens: number;
}

const state: RotState = {
  fileReadCounts: new Map(),
  ceilingTokens: MIN_CEILING_TOKENS,
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
    logger.warn({ contextTokens, ceiling: state.ceilingTokens }, 'rot_context_ceiling_exceeded');
    return 'context_size';
  }

  for (const [file, count] of state.fileReadCounts) {
    if (count >= SESSION_FILE_READ_CAP) {
      logger.warn({ file, count }, 'rot_file_thrashing');
      return 'file_thrashing';
    }
  }

  return null;
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
