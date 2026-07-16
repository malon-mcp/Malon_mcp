import type Database from 'better-sqlite3';
import { logger } from '../util/log.js';
import { generateApiKey, isApiKeyActive } from './api-key.js';
import { storeApiKey, listApiKeys, revokeApiKeyInDb } from './store.js';

export interface AdminInput {
  operation: string;
  label?: string;
  role?: string;
  key_id?: string;
}

export interface AdminResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export function handleAdmin(db: Database.Database, input: AdminInput): AdminResult {
  const { operation } = input;

  switch (operation) {
    case 'generate-key': {
      const label = input.label;
      if (!label || typeof label !== 'string' || label.length === 0) {
        return { success: false, error: 'label is required' };
      }
      const role = input.role ?? 'service';
      const validRoles = ['admin', 'operator', 'service', 'user', 'viewer'];
      if (!validRoles.includes(role)) {
        return {
          success: false,
          error: `invalid role "${role}". Must be one of: ${validRoles.join(', ')}`,
        };
      }
      const { raw, record } = generateApiKey(label, role);
      storeApiKey(db, { ...record, last_used_at: null });
      logger.info({ label, role, keyId: record.id }, 'api_key_generated');
      return {
        success: true,
        data: {
          key: raw,
          key_id: record.id,
          label: record.label,
          role: record.role,
          created_at: record.created_at,
        },
      };
    }

    case 'list-keys': {
      const keys = listApiKeys(db);
      return {
        success: true,
        data: {
          keys: keys.map((k) => ({
            id: k.id,
            label: k.label,
            role: k.role,
            created_at: k.created_at,
            expires_at: k.expires_at,
            revoked_at: k.revoked_at,
            last_used_at: k.last_used_at,
            active: isApiKeyActive(k),
          })),
        },
      };
    }

    case 'revoke-key': {
      const keyId = input.key_id;
      if (!keyId || typeof keyId !== 'string') {
        return { success: false, error: 'key_id is required' };
      }
      const existing = listApiKeys(db).find((k) => k.id === keyId);
      if (!existing) {
        return { success: false, error: `no API key found with id "${keyId}"` };
      }
      if (existing.revoked_at) {
        return { success: false, error: 'API key is already revoked' };
      }
      revokeApiKeyInDb(db, keyId);
      logger.info({ keyId, label: existing.label }, 'api_key_revoked');
      return {
        success: true,
        data: { key_id: keyId, revoked_at: new Date().toISOString() },
      };
    }

    default:
      return {
        success: false,
        error: `unknown operation "${operation}". Supported: generate-key, list-keys, revoke-key`,
      };
  }
}
