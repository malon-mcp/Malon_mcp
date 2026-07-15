import fs from 'node:fs';
import path from 'node:path';
import { logger } from './log.js';

const LOCK_NAME = '.malon.lock';

interface LockData {
  pid: number;
  startedAt: string;
  sessionId: string;
}

export function tryAcquireLock(malonDir: string, sessionId: string): boolean {
  const lockPath = path.join(malonDir, LOCK_NAME);

  try {
    const existing = readLock(lockPath);
    if (existing) {
      const pidAlive = isPidAlive(existing.pid);
      if (pidAlive) {
        const age = Date.now() - new Date(existing.startedAt).getTime();
        if (age < 24 * 60 * 60 * 1000) {
          logger.warn(
            { pid: existing.pid, startedAt: existing.startedAt, session_id: sessionId },
            'lock_already_held',
          );
          return false;
        }
        logger.warn({ pid: existing.pid, age }, 'lock_stale_pid_ignoring');
      } else {
        logger.info({ pid: existing.pid }, 'lock_previous_process_dead');
      }
    }
  } catch {
    // No lock file, safe to acquire
  }

  try {
    fs.mkdirSync(malonDir, { recursive: true });
    const data: LockData = { pid: process.pid, startedAt: new Date().toISOString(), sessionId };
    fs.writeFileSync(lockPath, JSON.stringify(data, null, 2), 'utf8');
    logger.debug({ pid: process.pid, session_id: sessionId }, 'lock_acquired');
    return true;
  } catch (err) {
    logger.warn({ err, session_id: sessionId }, 'lock_acquire_failed');
    return true;
  }
}

export function releaseLock(malonDir: string): void {
  const lockPath = path.join(malonDir, LOCK_NAME);
  try {
    const existing = readLock(lockPath);
    if (existing && existing.pid === process.pid) {
      fs.unlinkSync(lockPath);
      logger.debug({}, 'lock_released');
    }
  } catch {
    // Lock file already gone
  }
}

function readLock(lockPath: string): LockData | null {
  try {
    const content = fs.readFileSync(lockPath, 'utf8');
    return JSON.parse(content) as LockData;
  } catch {
    return null;
  }
}

function isPidAlive(pid: number): boolean {
  try {
    return process.kill(pid, 0);
  } catch {
    return false;
  }
}
