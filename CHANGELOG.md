# Changelog

## [0.0.1] - 2026-07-16

### Added

- Phase 1: Wedge — `malon_search`, `malon_status` MCP tools with search subagent, token accounting
- Phase 2: Security & Legal Hardening — path escape, SQL injection, shell injection protections; secret scanning; lockfile committed; install scripts disabled
- Phase 3: Free Tier Launch — `malon init`, `malon index`, rate limits, tokens-saved instrumentation, git hooks
- Phase 4: Memory & Rot — `malon_memory_write`, `malon_memory_get`, `malon_checkpoint` tools; two-rot-heuristic governor; memory auto-inject at session start; cache-friendly prompt ordering
- Phase 5: Grow — tree-sitter parsing for 6 languages (TS, JS, Python, Go, Rust, Java); file watcher with debounce; incremental re-index via git diff; 6-language parser test fixtures; performance benchmarking suite with nightly CI
