# Malon

Local-first MCP server for AI coding agents — search isolation, memory ledger, context rot detection, and cost governance.

## Quick start

```bash
# Initialize .malon/ directory, config, and index
npx malon init

# Show session status, spend, and rot flags
npx malon status

# Re-index the repository
npx malon index

# Incremental re-index (uses git diff since last indexed sha)
npx malon init --incremental
```

## How to use Malon with your coding agent

Malon gives your agent a `malon_search` tool that finds the right place
in the codebase before reading files. Add this to your `CLAUDE.md` /
`AGENTS.md`:

```
For any question about where something is implemented, prefer the
`malon_search` tool over native grep/read tools. The tool returns 1-3
file:line spans with a one-line justification — enough to read the
right slice instead of guessing.

When you finish a non-trivial change, call `malon_memory_write` with
the decision you made. Future sessions will see it via
`malon_memory_get` and pick up where you left off.
```

## Commands

```bash
malon init               # Initialize .malon/ dir, config, and full index
malon init --incremental # Incremental re-index (git diff based)
malon index              # Full re-index
malon status             # Show session stats, spend, rot flags, and tokens saved
malon reset              # Delete regenerable index and usage data
```

## Tools

Malon exposes MCP tools that your coding agent can call:

- `malon_search` — Search the indexed codebase and return precise file:line spans with a one-line justification
- `malon_memory_get` — Retrieve relevant memory entries from the ledger
- `malon_memory_write` — Write a new entry to the memory ledger (scoped to `.malon/memory/`)
- `malon_status` — Current session status, spend, rot flags, and tokens saved vs. baseline

## Tokens saved

Malon tracks the difference between what the primary agent *would have* spent
reading files natively and what it *actually* spent receiving Malon's spans.
This number is shown in `malon status` as `tokens_saved_cumulative`. It is a
transparency signal, not an optimization target — the agent's thinking is
never capped for cost reasons.

## Rate limits

Malon enforces per-session rate limits on `malon_search`:
- 100 calls per rolling window
- 500,000 tokens per session

Limits are adjustable in `.malon/config.yml`.

## Documentation

- [AGENTS.md](AGENTS.md) — Full engineering manual
- [SECURITY.md](SECURITY.md) — Security posture and data handling
- [TERMS.md](TERMS.md) — Terms of service
- [PRIVACY.md](PRIVACY.md) — Privacy policy

## License

MIT