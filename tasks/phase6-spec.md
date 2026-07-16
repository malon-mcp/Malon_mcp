# Spec: Phase 6 — Premium Tier (Hosted Layer Foundation)

## Objective

Build the engineering foundation for a premium hosted tier without weakening the open-source local-first trust story. This phase delivers:

1. **Data retention & deletion** — automated usage.log rotation, configurable retention policies, a `malon clean` purge command, and a data deletion API
2. **Hosted auth infrastructure** — API key management, session management, TOTP MFA, RBAC, all backed by SQLite (same DB pattern as the index)
3. **Incident response plan** — formal written plan with notification templates, runbook, contacts
4. **DPA template** — ready-to-send Data Processing Agreement
5. **Release hardening** — verified Trusted Publishing, version bump

## Commands

| Command                 | Purpose             |
| ----------------------- | ------------------- |
| `npm run build`         | TypeScript compile  |
| `npm test`              | Run all tests       |
| `npm run test:unit`     | Unit tests only     |
| `npm run test:security` | Security gate tests |
| `npm run typecheck`     | `tsc --noEmit`      |

## Project Structure (new files)

```
src/
├── auth/                             ← NEW: hosted auth module
│   ├── api-key.ts                    ← API key generation, hashing, validation
│   ├── session.ts                    ← Session token creation, validation, refresh
│   ├── mfa.ts                        ← TOTP MFA (setup, verify)
│   ├── rbac.ts                       ← Role definitions and permission checks
│   └── store.ts                      ← SQLite-backed auth persistence
├── governor/
│   └── retention.ts                  ← NEW: usage log rotation and data deletion
├── cli/
│   ├── index.ts                      ← (MODIFIED) add clean command
│   └── clean.ts                      ← NEW: data retention/purge command
├── types.ts                          ← (MODIFIED) add RetentionConfig, AuthConfig types
├── util/
│   └── config.ts                     ← (MODIFIED) add retention config parsing
docs/
├── INCIDENT_RESPONSE_PLAN.md         ← NEW: formal incident response plan
└── DPA_TEMPLATE.md                    ← NEW: Data Processing Agreement template
```

## Code Style

Follow existing Malon conventions: ESM, `node:` protocol imports, named exports, kebab-case filenames, `MalonError` for errors, `resolveInside` for path safety, parameterized SQL.

### Example style:

```typescript
import crypto from 'node:crypto';
import { MalonError } from '../types.js';

export function generateApiKey(): { key: string; hash: string } {
  const raw = `mal_${crypto.randomBytes(32).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { key: raw, hash };
}
```

## Testing Strategy

| Test file                              | What it covers                                          |
| -------------------------------------- | ------------------------------------------------------- |
| `test/unit/auth/api-key.test.ts`       | Key generation, hashing, validation, revocation         |
| `test/unit/auth/session.test.ts`       | Session create, validate, refresh, expiry               |
| `test/unit/auth/mfa.test.ts`           | TOTP setup, verification, recovery codes                |
| `test/unit/auth/rbac.test.ts`          | Role hierarchy, permission checks                       |
| `test/unit/governor/retention.test.ts` | Usage log rotation, purge, config parsing               |
| `test/security/auth-security.test.ts`  | Timing attacks on key comparison, session token entropy |

## Boundaries

- **Always:** Canonicalize paths, parameterize SQL, hash secrets at rest, rate-limit auth endpoints
- **Ask first:** Adding auth dependencies (currently using only built-in `node:crypto`)
- **Never:** Store plaintext secrets, log auth tokens or API keys, allow session token injection in SQL

## Success Criteria

1. `malon clean --usage-logs` purges usage data older than configured retention period
2. Usage log rotation runs automatically at server start with configurable max age
3. API key generation produces valid `mal_`-prefixed keys with SHA-256 hashed storage
4. Session tokens are cryptographically random, time-limited, and refreshable
5. TOTP MFA setup and verification works with standard authenticator apps
6. RBAC enforces role hierarchy (admin > operator > service > user)
7. All auth data is SQLite-backed with the same WAL mode as index.db
8. Incident response plan document is complete with notification templates
9. DPA template covers all GDPR/DPDPA requirements
10. All existing tests still pass; new tests have >90% coverage on auth code

## Open Questions

1. Should the hosted auth layer live in this repo (core) or a separate repo (premium closed-source)? Per Execution.md Phase 6, the hosted layer is closed-source separate repo — but auth infrastructure for the local server (API keys for automation, local sessions) is useful in-core. Decision: build the auth primitives in-core (they're useful for local session management and API key auth for the MCP server), but the actual hosted web layer lives in a separate private repo.
2. What's the retention period for usage.log? Start with 30 days default, configurable.
3. Are recovery codes needed for MFA? Yes — generate 8 single-use recovery codes on MFA setup.
