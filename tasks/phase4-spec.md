# Spec: Phase 4 — Close the Loop (Memory + Rot)

## Objective

Complete the Memory Ledger and Rot Governor so a developer can close a chat, reopen weeks later, and the agent starts with a short memory summary instead of a full re-read.

Success criteria from Execution.md:

- Memory auto-inject at session start works
- `malon_memory_write` is structurally scoped to `.malon/memory/` (already done + tested)
- Secret scanner runs on memory writes before persistence (already done + tested)
- Rot heuristics are exactly the two in §11.3 (already done + tested)
- Repo content is treated as untrusted data inside the Subagent (already done + tested)

## Commands

```
Build:    npm run build
Test:     npm test
Test:sec: npm run test:security
Test:unit: npm run test:unit
Type:     npm run typecheck (or npx tsc --noEmit)
Lint:     npm run lint
```

## Project Structure (Phase 4 additions)

```
src/
  orchestrator/
    router.ts          ← existing, add cache-ordering integration
    cache-ordering.ts  ← NEW: context ordering for prompt-cache hits
  memory/
    ledger.ts          ← existing
    secret-scan.ts     ← existing
    templates/         ← NEW: template markdown files
      decisions.md
      conventions.md
      rejected.md
      session.md
  governor/
    pricing.ts         ← NEW: pricing config validation with age check
    rot.ts             ← existing
    token-accounting.ts← existing
  index/
    index.ts           ← existing
    incremental.ts     ← existing
  cli/
    init.ts            ← extend with git hook installation
  util/
    config.ts          ← extend with pricing age validation
```

## Code Style

Same conventions as existing codebase:

- ESM modules, `import`/`export`, `node:` protocol for built-ins
- `camelCase` for variables/functions, `PascalCase` for types
- `snake_case` for MCP tool names with `malon_` prefix
- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` in tsconfig
- Result types at module boundaries, throw only for unexpected conditions

## Testing Strategy

- Unit tests next to source files in `test/unit/`
- Security tests in `test/security/`
- Existing tests must all pass after each increment
- Each increment verified independently

## Boundaries

- **Always:** Run security tests before completing any item; verify all prior tests still pass
- **Ask first:** Any changes to MCP tool schemas, security models, or file I/O
- **Never:** Weaken the path-escape, SQL-injection, or memory-escape protections

## Items

### Item 1: Cache Ordering (`src/orchestrator/cache-ordering.ts`)

Create a context-ordering module that arranges tool-call context for prompt-cache efficiency. Stable content (system prompt, memory summary) goes before dynamic content (query, file content). The router uses this to order the envelope returned from `malon_search`.

### Item 2: Memory Templates (`src/memory/templates/`)

Create the four template markdown files that define the expected format for memory entries. These match AGENTS.md §10.2 format exactly. Each template is a short `.md` file with example entries and format guidance.

### Item 3: Git Hooks for Auto-Reindex

Extend `malon init` to install a `post-commit` git hook that triggers `malon init --incremental` after every commit. This is the default indexing trigger described in §12.3.

### Item 4: Pricing Config Age Validation

Add validation in `config.ts` that checks `pricing.last_verified` at server start. If >90 days old, refuse to start. If >30 days old, log a warning. Per AGENTS.md §11.1.
