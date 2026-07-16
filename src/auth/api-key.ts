import crypto from 'node:crypto';
import { timingSafeEqual } from 'node:crypto';
import { MalonError } from '../types.js';

const KEY_PREFIX = 'mal_';
const KEY_BYTES = 32;
const HASH_ALGORITHM = 'sha256';

export interface ApiKeyRecord {
  id: string;
  key_hash: string;
  label: string;
  role: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
}

export function generateApiKey(
  label: string,
  role = 'service',
): {
  raw: string;
  record: Omit<ApiKeyRecord, 'last_used_at'>;
} {
  const rawBytes = crypto.randomBytes(KEY_BYTES);
  const raw = `${KEY_PREFIX}${rawBytes.toString('hex')}`;
  const keyHash = hashApiKey(raw);

  const record: Omit<ApiKeyRecord, 'last_used_at'> = {
    id: crypto.randomUUID(),
    key_hash: keyHash,
    label,
    role,
    created_at: new Date().toISOString(),
    expires_at: null,
    revoked_at: null,
  };

  return { raw, record };
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash(HASH_ALGORITHM).update(rawKey).digest('hex');
}

export function validateApiKeyFormat(rawKey: string): boolean {
  if (!rawKey.startsWith(KEY_PREFIX)) return false;
  const hexPart = rawKey.slice(KEY_PREFIX.length);
  if (hexPart.length !== KEY_BYTES * 2) return false;
  return /^[a-f0-9]+$/.test(hexPart);
}

export function verifyApiKey(rawKey: string, storedHash: string): boolean {
  if (!validateApiKeyFormat(rawKey)) return false;
  const computedHash = hashApiKey(rawKey);
  if (computedHash.length !== storedHash.length) return false;
  try {
    return timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

export function isApiKeyActive(record: ApiKeyRecord): boolean {
  if (record.revoked_at) return false;
  if (record.expires_at && new Date(record.expires_at).getTime() < Date.now()) return false;
  return true;
}

export function revokeApiKey(record: ApiKeyRecord): ApiKeyRecord {
  return {
    ...record,
    revoked_at: new Date().toISOString(),
  };
}

export class AuthError extends MalonError {
  constructor(message: string, fix?: string) {
    super('config', message, fix);
    this.name = 'AuthError';
  }
}
