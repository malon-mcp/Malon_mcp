# Malon

```
███╗   ███╗ █████╗ ██╗      ██████╗ ███╗   ██╗
████╗ ████║██╔══██╗██║     ██╔═══██╗████╗  ██║
██╔████╔██║███████║██║     ██║   ██║██╔██╗ ██║
██║╚██╔╝██║██╔══██║██║     ██║   ██║██║╚██╗██║
██║ ╚═╝ ██║██║  ██║███████╗╚██████╔╝██║ ╚████║
╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝
```

> **Cut your AI coding agent's token waste by 69%. Zero accuracy loss.**

Malon is a local-first MCP server that sits between your coding agent (Claude Code, Codex CLI, Cursor, Windsurf, Aider) and your codebase. Instead of your expensive primary model burning tokens on 40 grep hits and six dead-end files, Malon's cheap subagent does the hunting — and your agent only sees the 2-3 file:line spans that actually matter.

```bash
npx malon init         # 5-second setup
# Then add the MCP server to your agent — done.
```

[Install](#quick-start) · [How it works](#how-it-works) · [Benchmarks](#benchmarks) · [Security](#security) · [Docs](AGENTS.md)

---

## Why Malon?

Every coding agent has the same problem: **it spends most of its thinking budget on navigation, not answers.**

- You ask "where is JWT validated?" — the agent greps the repo, reads 8 files, burns 24K tokens, and finds the answer on line 47 of the 6th file.
- You open a project after two weeks — the agent re-reads everything from scratch, context window fills with noise, and hallucinations creep in.

Malon fixes both:

| Problem                               | Malon's solution                                      | Result                   |
| ------------------------------------- | ----------------------------------------------------- | ------------------------ |
| Agent burns tokens on grep/read loops | Cheap subagent narrows search in 2-3 rounds           | **69% fewer tokens**     |
| Every session starts from zero        | Git-tracked memory ledger persists decisions          | **No re-read needed**    |
| Context gets noisy mid-session        | Rot governor detects thrashing, recommends checkpoint | **Fewer hallucinations** |
| No visibility into spending           | Cost governor tracks every token, shows live spend    | **Full transparency**    |

---

## Quick start

```bash
# 1. Initialize Malon in your project
npx malon init

# 2. Start the MCP server
npx malon

# 3. Your agent connects automatically via STDIO.
#    Call malon_search("where is X") instead of native grep.
```

**One-time setup.** Works in under 10 seconds on any repo.

---

## Benchmarks

69.2% token savings measured on a 5-language, 6-file search run across 5 query types. Each benchmark is reproducible — run `test-env/run.ps1` yourself.

| Query type      | Queries | Native tokens | Malon tokens | Tokens saved |
| --------------- | ------- | ------------- | ------------ | ------------ |
| `symbol_lookup` | 3       | 16,000        | 4,500        | **71.9%**    |
| `cross_file`    | 2       | 8,000         | 2,900        | **63.7%**    |
| **Overall**     | **5**   | **24,000**    | **7,400**    | **69.2%**    |

**Larger repos → bigger savings.** Malon shines when queries match 5+ files — the subagent reads exactly the relevant spans while a naive agent reads everything.

### What makes the savings real

| Technique           | Without              | With                                |
| ------------------- | -------------------- | ----------------------------------- |
| System prompt       | ~1,000 tokens        | ~650 tokens (35% smaller)           |
| Avg subagent rounds | 3                    | 2 (early-exit when confident)       |
| Avg span size       | 300 tokens           | 150 tokens (precision-guided)       |
| History retention   | Full context kept    | Last 2 rounds (saves ~2K tok/query) |
| Repeated queries    | Full cost every time | Cached for 5 min (0 tok)            |

### Per-query breakdown

| Query           | Files | Native | Malon | Saved     |
| --------------- | ----- | ------ | ----- | --------- |
| `validateToken` | 2     | 8,000  | 1,600 | **80.0%** |
| `fibonacci`     | 1     | 4,000  | 1,450 | **63.7%** |
| `Config`        | 1     | 4,000  | 1,450 | **63.7%** |
| `handleLogin`   | 1     | 4,000  | 1,450 | **63.7%** |
| `Database`      | 1     | 4,000  | 1,450 | **63.7%** |

Pricing: `gemini-2.0-flash` at $0.10/M input, $0.40/M output.

---

## How it works

```
Your Coding Agent ──→ malon_search("where is JWT validated?")
                          │
                          ▼
                    Search Subagent (Haiku-class, 2-3 rounds)
                     fts_grep → read_span → graph_walk
                          │
                          ▼
                    1-3 precise file:line spans
                     + one-line justification each
                          │
                          ▼
                    Your agent reads only those spans
                          │
                          ▼
                    Cost Governor logs tokens_saved
                    Rot Governor checks for thrashing
```

### The four core loops

**Search loop** — Your agent calls `malon_search` instead of native grep. Malon's cheap subagent runs 2-3 rounds (FTS5 grep → span reading → graph walk), then returns only the 1-3 relevant spans. Your primary model never sees the intermediate noise.

**Memory loop** — Call `malon_memory_write("decisions", "Use Prisma", "...")` after any non-trivial change. The entry goes to `.malon/memory/decisions.md` — git-tracked, diffable, reviewable. Reopen the project weeks later and `malon_memory_get` returns a "where you left off" summary in ~3K tokens instead of a full repo re-read.

**Cost loop** — Every subagent call is logged with model, provider, tokens, and cost. `malon status` shows live spend, tokens used, and cumulative tokens saved vs. a naive baseline. No surprise bills. No hidden spending.

**Rot loop** — When context size exceeds a repo-calibrated ceiling or the same file is re-read 3+ times, Malon flags it. It saves a structured checkpoint to the memory ledger and recommends a fresh session — your progress is preserved, not lost.

---

## Commands

```bash
malon init               # Initialize .malon/, config, and full index
malon init --incremental # Incremental re-index (git diff since last SHA)
malon init --local       # Local-only mode (auto-detect Ollama)
malon index              # Full re-index (re-parse all supported files)
malon status             # Session stats: spend, tokens saved, rot flags
malon reset              # Delete index.db, usage.log, lock file
malon local-check        # Test local LLM (Ollama) availability
```

---

## MCP tools

| Tool                 | What it does                                                         |
| -------------------- | -------------------------------------------------------------------- |
| `malon_search`       | Search codebase, return 1-3 file:line spans with justification       |
| `malon_memory_get`   | Retrieve relevant memory entries (decisions, conventions, sessions)  |
| `malon_memory_write` | Write to memory ledger. Scoped to `.malon/memory/`. Rejects secrets. |
| `malon_status`       | Session spend, tokens, rot flags, tokens saved vs baseline           |
| `malon_checkpoint`   | Trigger rot checkpoint, save session progress to memory              |
| `malon_admin`        | Manage API keys (generate, list, revoke)                             |

---

## For your AGENTS.md

Add this to your `CLAUDE.md`, `AGENTS.md`, or `.cursorrules`:

```
## Malon MCP tools

Malon gives you search, memory, and status tools. Use them instead of
native grep/read when possible to stay focused on the answer.

1. For "where is X" or "how does Y work" — call `malon_search` first.
   It returns 1-3 precise file:line spans with a one-line justification,
   so you read the right slice instead of guessing.

2. For cross-file context (callers, imports, related symbols) —
   call `malon_search` with the symbol name. The subagent walks the
   call graph for you.

3. After a non-trivial change — call `malon_memory_write` with the
   decision. Future sessions will see it via `malon_memory_get`.

4. When reopening a project after days/weeks — call `malon_memory_get`
   with an empty query for a "where we left off" summary.

5. Check `malon_status` for spend, tokens saved, and rot flags.
   If a `rot_flag` is set, consider a fresh session — progress is saved.

6. Don't bypass Malon with native tools for cross-file questions.
   That defeats the purpose. Report missing results instead.
```

---

## Security

Malon is designed so your code stays on your machine.

- **Local-first.** The Search Subagent sends short code spans (1-3 snippets) to your LLM provider — never full files.
- **Local-only option.** Configure Ollama for zero outbound data.
- **Secret scanning.** `malon_memory_write` rejects API keys, tokens, and private keys before they touch disk.
- **Path confinement.** Every filesystem operation is validated against the repo root. Path escape attacks are rejected in code.
- **No telemetry.** Zero outbound calls except to your configured LLM provider. Opt-in only, default off.
- **Concurrent protection.** `.malon.lock` prevents double-indexing. Stale locks auto-recover.

[Full security posture →](SECURITY.md)

---

## Supported languages

TypeScript · TSX · JavaScript · JSX · Python · Go · Rust · Java

---

## Configuration

All settings in `.malon/config.yml`:

- **pricing** — Provider pricing tables with `last_verified` date
- **search** — Provider, model, timeout, max subagent rounds
- **cost** — Hard dollar ceiling (default: none), shadow heuristic
- **rate_limits** — Per-session call/token limits
- **log** — Log level (`info`/`debug`), optional file path
- **telemetry** — Opt-in analytics (disabled by default)

---

## Documentation

| Doc                        | What's in it                                                  |
| -------------------------- | ------------------------------------------------------------- |
| [AGENTS.md](AGENTS.md)     | Engineering manual: architecture, security posture, dev guide |
| [SECURITY.md](SECURITY.md) | End-user security posture and data handling                   |
| [TERMS.md](TERMS.md)       | Terms of service                                              |
| [PRIVACY.md](PRIVACY.md)   | Privacy policy                                                |

---

## Support & Issues

- **Email:** malonmcp@gmail.com
- **GitHub Issues:** [github.com/malon-mcp/Malon_mcp/issues](https://github.com/malon-mcp/Malon_mcp/issues)

---

## License

MIT
