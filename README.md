# Malon

Local-first MCP server for AI coding agents — search isolation, memory ledger, context rot detection, and cost governance.

Malon sits between your existing coding agent (Claude Code, Codex CLI, Cursor, Windsurf, Aider) and your codebase. It isolates the noisy search work into a cheap subagent so the primary model only sees the 2-3 file:line spans that actually matter — never the 40 grep hits and six dead-end files.

## Quick start

```bash
# Initialize .malon/ directory, config, and full index
npx malon init

# Show session status, spend, rot flags, and tokens saved
npx malon status

# Full re-index
npx malon index

# Incremental re-index (uses git diff since last indexed sha)
npx malon init --incremental

# Delete regenerable index, cache, and usage data
npx malon reset
```

## Setup

1. **Install:** `npm install -g malon` or run via `npx malon`
2. **Init:** Run `npx malon init` in your project root. This creates `.malon/` with:
   - `config.yml` — pricing, search, rate limits, logging
   - `index.db` — SQLite FTS5 index of your codebase (gitignored)
   - `memory/` — git-tracked markdown ledger (decisions, conventions, sessions)
3. **Configure your agent:** Add the [AGENTS.md snippet](#for-your-agentsmd) to your agent's rules file
4. **Start the MCP server:** Run `malon` (or configure your IDE to launch it with STDIO)

## How it works

```
Your Coding Agent ──→ malon_search("where is JWT validated?")
                          │
                          ▼
                    Search Subagent (Haiku-class)
                    2-4 rounds of: fts_grep → read_span → graph_walk
                          │
                          ▼
                    1-3 precise file:line spans
                          │
                          ▼
                    Your agent reads only those spans
                          │
                          ▼
                    Cost Governor logs tokens_saved
                    Rot Governor checks for context thrashing
```

## Commands

```bash
malon init               # Initialize .malon/ dir, config, and full index
malon init --incremental # Incremental re-index (git diff based)
malon index              # Full re-index (re-parses all supported files)
malon status             # Show session stats, spend, rot flags, tokens saved, memory summary
malon reset              # Delete index.db, usage.log, and .malon.lock
```

## Tools

Malon exposes MCP tools your coding agent can call:

| Tool                 | Purpose                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `malon_search`       | Search the indexed codebase and return 1-3 file:line spans with a one-line justification |
| `malon_memory_get`   | Retrieve relevant memory entries from the ledger (decisions, conventions, sessions)      |
| `malon_memory_write` | Write a new entry to the memory ledger. Scoped to `.malon/memory/`. Rejects secrets.     |
| `malon_status`       | Current session status: spend, tokens used, tokens saved vs. baseline, rot flags         |
| `malon_checkpoint`   | (Coming soon) — Explicitly trigger a rot checkpoint, saving session progress             |

## For your AGENTS.md

Add this snippet to your `CLAUDE.md`, `AGENTS.md`, or `.cursorrules` to teach
your coding agent how to use Malon:

```
## Malon MCP tools

Malon gives you search, memory, and status tools. Use them instead of
native grep/read when possible to stay focused on the answer.

1. When you have a question about "where is X" or "how does Y work,"
   call `malon_search` first. It returns 1-3 precise file:line spans
   with a one-line justification — enough to read the right slice
   instead of guessing.

2. When you need cross-file context (callers, imports, related symbols),
   call `malon_search` with the symbol name. The Subagent walks the
   call graph; you don't have to.

3. When you finish a non-trivial change, call `malon_memory_write`
   with the decision you made. Future sessions will see it via
   `malon_memory_get` and pick up where you left off.

4. When you reopen a project after days/weeks, call `malon_memory_get`
   with an empty query to get a "where we left off" summary. Call it
   with a specific topic to load deeper context.

5. Call `malon_status` to check session spend, tokens saved vs.
   baseline, and rot flags. If a `rot_flag` is set, consider starting
   a fresh session — your progress is saved in the memory ledger.

6. **Don't bypass Malon with native tools for cross-file questions.**
   The whole point of Malon is to keep the expensive primary model
   from burning tokens on search noise. If Malon's search is missing
   something, report it — don't silently work around it.
```

## Security

- **Local-first by default.** Your code stays on your machine. The Search
  Subagent sends short code spans (1-3 file:line snippets) to your
  configured LLM provider — never full files.
- **Secret scanning.** `malon_memory_write` rejects writes containing
  known secret patterns (API keys, tokens, private keys).
- **Path confinement.** All filesystem operations are validated against
  the repo root. Path escape attacks are rejected at the code level.
- **No telemetry.** Zero outbound calls except to your configured LLM
  provider. Opt-in only.
- **Lock file.** A `.malon.lock` prevents concurrent server starts in
  the same repo.

See [SECURITY.md](SECURITY.md) for the full security posture.

## Tokens saved

Malon tracks the difference between what the primary agent _would have_ spent
reading files natively and what it _actually_ spent receiving Malon's search results.
This number is shown in `malon status` as `tokens_saved_cumulative`.

**Important:** This is a transparency signal, not an optimization target.
The agent's thinking is never capped for cost reasons. If the metric is
negative on a given call, the system logs it honestly and continues.

## Error handling

When a tool encounters an error, the response includes a reference ID:

```
error: rate_limit: Rate limit exceeded
try:    Wait for the rate limit window to reset, or adjust limits in config.yml
ref:    550e8400-e29b-41d4-a716-446655440000
```

Include this session ID when reporting issues.

## Rate limits

Default per-session limits on `malon_search`:

- 100 calls per rolling 60-second window
- 500,000 tokens per session

Adjustable in `.malon/config.yml` under `rate_limits`:

```yaml
rate_limits:
  max_calls_per_session: 100
  max_tokens_per_session: 500000
  window_ms: 60000
```

## Concurrent server protection

Malon uses `.malon/.malon.lock` to prevent multiple server instances from
running in the same repo simultaneously. If a second instance starts, it
exits with a clear message. Stale lock files from crashed processes are
detected and cleaned up automatically.

## Configuration

All configuration lives in `.malon/config.yml`:

- **pricing** — LLM provider pricing tables with `last_verified` date
- **search** — Provider, model, timeout, max rounds for the Search Subagent
- **cost** — Hard dollar ceiling (default: none) and shadow heuristic for tokens-saved
- **rate_limits** — Per-session call/token limits
- **log** — Log level (info/debug) and optional file path
- **telemetry** — Opt-in telemetry (default: disabled)

## Supported languages

Currently indexed and parsed:

- TypeScript / TSX
- JavaScript / JSX / MJS / CJS
- Python
- Go
- Rust
- Java

## Documentation

- [AGENTS.md](AGENTS.md) — Full engineering manual with architecture, security posture, and development guide
- [SECURITY.md](SECURITY.md) — Security posture and data handling for end users
- [TERMS.md](TERMS.md) — Terms of service
- [PRIVACY.md](PRIVACY.md) — Privacy policy

## License

MIT
