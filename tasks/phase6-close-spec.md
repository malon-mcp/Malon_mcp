# Spec: Phase 6 Closure — Wire Auth Into the MCP Server

## Objective

The `src/auth/` module (5 files, ~580 LOC) is built but has zero integration with the MCP server. This slice wires it in:

1. Auth schema initialized on server start (same `index.db`)
2. A `malon_admin` MCP tool for API key management (generate, list, revoke)
3. Security test suite for auth primitives
4. All existing tests still pass; new code is lint-clean

## Commands

```bash
Build:   npm run build
Type:    npx tsc --noEmit
Lint:    npx eslint .
Unit:    npm run test:unit
Sec:     npm run test:security
Int:     npm run test:integration
All:     npm test
```

## Project Structure (new/modified files)

```
src/
├── auth/
│   ├── api-key.ts          ← (unmodified)
│   ├── session.ts          ← (unmodified)
│   ├── mfa.ts              ← (unmodified)
│   ├── rbac.ts             ← (unmodified)
│   └── store.ts            ← (unmodified)
├── server/
│   └── index.ts            ← (MODIFIED) call initAuthSchema after initIndex
├── orchestrator/
│   └── router.ts           ← (MODIFIED) add malon_admin handler
├── auth/
│   └── admin-handler.ts    ← (NEW) malon_admin tool implementation
test/
├── security/
│   └── auth-security.test.ts  ← (NEW) timing-safe comparison, token entropy, etc.
└── integration/
    └── mcp-tools.test.ts   ← (MODIFIED) add admin tool integration tests
```

## Code Style

Follow existing Malon conventions:

- ESM with `node:` protocol imports
- Named exports, kebab-case filenames
- `Result<T, MalonError>` at module boundaries
- Parameterized SQL, `resolveInside` for paths
- Structured JSON logging via `logger`

## Testing Strategy

| Test file                             | What it covers                                                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/security/auth-security.test.ts` | Timing-safe comparison (known failure inputs), session token entropy (48+ bytes), API key format validation edge cases, no plaintext secrets logged, recovery codes are single-use |
| `test/integration/mcp-tools.test.ts`  | malon_admin tool contract: generate-key, list-keys, revoke-key sub-operations                                                                                                      |

## Boundaries

- **Always:** Use `timingSafeEqual` for hash comparison, parameterize SQL, hash secrets at rest
- **Never:** Store plaintext API keys, log auth tokens or API keys, expose session tokens in tool output

## Success Criteria

1. `initAuthSchema` called automatically when DB initializes
2. `malon_admin` tool can generate `mal_`-prefixed API keys via the server
3. `malon_admin` tool can list keys with metadata
4. `malon_admin` tool can revoke keys
5. Auth security tests verify timing-safe comparison, entropy requirements
6. All existing tests pass; lint and typecheck clean
