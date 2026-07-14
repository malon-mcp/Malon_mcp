export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] <= LOG_LEVELS[currentLevel];
}

function formatLog(level: LogLevel, msg: string, meta?: Record<string, unknown>): string {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
  };
  return JSON.stringify(entry);
}

export const logger = {
  error: (meta: Record<string, unknown> | string, msg?: string) => {
    if (!shouldLog('error')) return;
    const actual = typeof meta === 'string' ? {} : meta;
    const m = typeof meta === 'string' ? meta : msg ?? '';
    process.stderr.write(formatLog('error', m, actual) + '\n');
  },
  warn: (meta: Record<string, unknown> | string, msg?: string) => {
    if (!shouldLog('warn')) return;
    const actual = typeof meta === 'string' ? {} : meta;
    const m = typeof meta === 'string' ? meta : msg ?? '';
    process.stderr.write(formatLog('warn', m, actual) + '\n');
  },
  info: (meta: Record<string, unknown> | string, msg?: string) => {
    if (!shouldLog('info')) return;
    const actual = typeof meta === 'string' ? {} : meta;
    const m = typeof meta === 'string' ? meta : msg ?? '';
    process.stderr.write(formatLog('info', m, actual) + '\n');
  },
  debug: (meta: Record<string, unknown> | string, msg?: string) => {
    if (!shouldLog('debug')) return;
    const actual = typeof meta === 'string' ? {} : meta;
    const m = typeof meta === 'string' ? meta : msg ?? '';
    process.stderr.write(formatLog('debug', m, actual) + '\n');
  },
};
