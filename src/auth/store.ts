import type Database from 'better-sqlite3';
import { logger } from '../util/log.js';
import type { ApiKeyRecord } from './api-key.js';
import type { SessionRecord } from './session.js';
import type { MfaRecord } from './mfa.js';

const AUTH_SCHEMA = `
CREATE TABLE IF NOT EXISTS auth_api_keys (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'service',
  created_at TEXT NOT NULL,
  expires_at TEXT,
  revoked_at TEXT,
  last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_api_keys_hash ON auth_api_keys(key_hash);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  refreshed_at TEXT,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);

CREATE TABLE IF NOT EXISTS auth_mfa (
  user_id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  recovery_hashes TEXT NOT NULL,
  enabled_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  last_login_at TEXT
);
`;

export function initAuthSchema(db: Database.Database): void {
  db.exec(AUTH_SCHEMA);
  logger.debug({}, 'auth_schema_initialized');
}

export function storeApiKey(db: Database.Database, record: ApiKeyRecord): void {
  const stmt = db.prepare(`
    INSERT INTO auth_api_keys (id, key_hash, label, role, created_at, expires_at, revoked_at, last_used_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    record.id,
    record.key_hash,
    record.label,
    record.role,
    record.created_at,
    record.expires_at,
    record.revoked_at,
    record.last_used_at,
  );
}

export function getApiKeyByHash(db: Database.Database, hash: string): ApiKeyRecord | null {
  const row = db.prepare('SELECT * FROM auth_api_keys WHERE key_hash = ?').get(hash) as
    Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToApiKey(row);
}

export function listApiKeys(db: Database.Database): ApiKeyRecord[] {
  const rows = db.prepare('SELECT * FROM auth_api_keys ORDER BY created_at DESC').all() as Record<
    string,
    unknown
  >[];
  return rows.map(rowToApiKey);
}

export function updateApiKeyLastUsed(db: Database.Database, id: string, timestamp: string): void {
  db.prepare('UPDATE auth_api_keys SET last_used_at = ? WHERE id = ?').run(timestamp, id);
}

export function revokeApiKeyInDb(db: Database.Database, id: string): void {
  const timestamp = new Date().toISOString();
  db.prepare('UPDATE auth_api_keys SET revoked_at = ? WHERE id = ?').run(timestamp, id);
}

function rowToApiKey(row: Record<string, unknown>): ApiKeyRecord {
  return {
    id: row['id'] as string,
    key_hash: row['key_hash'] as string,
    label: row['label'] as string,
    role: row['role'] as string,
    created_at: row['created_at'] as string,
    expires_at: (row['expires_at'] as string) ?? null,
    revoked_at: (row['revoked_at'] as string) ?? null,
    last_used_at: (row['last_used_at'] as string) ?? null,
  };
}

export function storeSession(db: Database.Database, record: SessionRecord): void {
  const stmt = db.prepare(`
    INSERT INTO auth_sessions (id, token_hash, user_id, role, created_at, expires_at, refreshed_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    record.id,
    record.token_hash,
    record.user_id,
    record.role,
    record.created_at,
    record.expires_at,
    record.refreshed_at,
    JSON.stringify(record.metadata),
  );
}

export function getSessionByTokenHash(
  db: Database.Database,
  tokenHash: string,
): SessionRecord | null {
  const row = db.prepare('SELECT * FROM auth_sessions WHERE token_hash = ?').get(tokenHash) as
    Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToSession(row);
}

export function updateSession(db: Database.Database, record: SessionRecord): void {
  db.prepare('UPDATE auth_sessions SET expires_at = ?, refreshed_at = ? WHERE id = ?').run(
    record.expires_at,
    record.refreshed_at,
    record.id,
  );
}

export function deleteSession(db: Database.Database, sessionId: string): void {
  db.prepare('DELETE FROM auth_sessions WHERE id = ?').run(sessionId);
}

export function deleteUserSessions(db: Database.Database, userId: string): void {
  db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(userId);
}

function rowToSession(row: Record<string, unknown>): SessionRecord {
  return {
    id: row['id'] as string,
    token_hash: row['token_hash'] as string,
    user_id: row['user_id'] as string,
    role: row['role'] as string,
    created_at: row['created_at'] as string,
    expires_at: row['expires_at'] as string,
    refreshed_at: (row['refreshed_at'] as string) ?? null,
    metadata: parseMetadata(row['metadata'] as string | null | undefined),
  };
}

function parseMetadata(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function storeMfa(db: Database.Database, record: MfaRecord, userId: string): void {
  db.prepare(
    'INSERT OR REPLACE INTO auth_mfa (user_id, secret_hash, recovery_hashes, enabled_at) VALUES (?, ?, ?, ?)',
  ).run(userId, record.secret_hash, JSON.stringify(record.recovery_hashes), record.enabled_at);
}

export function getMfa(db: Database.Database, userId: string): MfaRecord | null {
  const row = db.prepare('SELECT * FROM auth_mfa WHERE user_id = ?').get(userId) as
    Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    secret_hash: row['secret_hash'] as string,
    recovery_hashes: JSON.parse((row['recovery_hashes'] as string) ?? '[]') as string[],
    enabled_at: row['enabled_at'] as string,
  };
}

export function deleteMfa(db: Database.Database, userId: string): void {
  db.prepare('DELETE FROM auth_mfa WHERE user_id = ?').run(userId);
}

export function storeUser(
  db: Database.Database,
  user: { id: string; email: string; role?: string },
): void {
  db.prepare(
    'INSERT OR IGNORE INTO auth_users (id, email, role, created_at) VALUES (?, ?, ?, ?)',
  ).run(user.id, user.email, user.role ?? 'user', new Date().toISOString());
}

export function updateUserLogin(db: Database.Database, userId: string): void {
  db.prepare('UPDATE auth_users SET last_login_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    userId,
  );
}

export function purgeAuthData(db: Database.Database): void {
  db.exec('DELETE FROM auth_api_keys');
  db.exec('DELETE FROM auth_sessions');
  db.exec('DELETE FROM auth_mfa');
  db.exec('DELETE FROM auth_users');
  logger.info({}, 'auth_data_purged');
}
