import crypto from 'node:crypto';

const SESSION_TOKEN_BYTES = 48;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export interface SessionRecord {
  id: string;
  token_hash: string;
  user_id: string;
  role: string;
  created_at: string;
  expires_at: string;
  refreshed_at: string | null;
  metadata: Record<string, unknown>;
}

export interface CreateSessionInput {
  userId: string;
  role?: string;
  ttlMs?: number;
  metadata?: Record<string, unknown>;
}

export function createSession(input: CreateSessionInput): {
  token: string;
  record: SessionRecord;
} {
  const rawBytes = crypto.randomBytes(SESSION_TOKEN_BYTES);
  const token = rawBytes.toString('base64url');
  const tokenHash = hashSessionToken(token);

  const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;
  const now = new Date();

  const record: SessionRecord = {
    id: crypto.randomUUID(),
    token_hash: tokenHash,
    user_id: input.userId,
    role: input.role ?? 'user',
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttlMs).toISOString(),
    refreshed_at: null,
    metadata: input.metadata ?? {},
  };

  return { token, record };
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function isSessionExpired(record: SessionRecord): boolean {
  return new Date(record.expires_at).getTime() < Date.now();
}

export function refreshSession(record: SessionRecord, ttlMs?: number): SessionRecord {
  const newTtl = ttlMs ?? DEFAULT_TTL_MS;
  return {
    ...record,
    expires_at: new Date(Date.now() + newTtl).toISOString(),
    refreshed_at: new Date().toISOString(),
  };
}

export function getRemainingTtlMs(record: SessionRecord): number {
  const expiry = new Date(record.expires_at).getTime();
  const remaining = expiry - Date.now();
  return Math.max(0, remaining);
}
