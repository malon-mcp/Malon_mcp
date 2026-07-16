# Changelog

## [0.6.1] - 2026-07-16

### Added

- Phase 7: Enterprise Readiness
  - Local-model (Ollama) first-class toggle (`malon init --local`, `malon local-check`)
  - `docs/ACCESS_CONTROL_POLICY.md` — 5 RBAC roles, auth mechanisms, review cadence
  - `docs/CHANGE_MANAGEMENT_PROCESS.md` — C0-C3 classification, CRB, rollback
  - `docs/VENDOR_SECURITY_QUESTIONNAIRE.md` — 12-section pre-drafted answers
  - `docs/SOC2_READINESS.md` — 50+ TSC criteria, 7 gaps, evidence framework
  - Gemini provider support (default provider)

### Fixed

- CI/CD workflow: fixed `release.yml` to be self-contained, added `workflow_call` trigger
- SECURITY.md: data retention link matches Gemini default provider
- README: documented `malon_admin` tool, unmarked `malon_checkpoint` as shipped

## [0.6.0] - 2026-07-16

### Added

- Phase 6: Premium Tier Foundation
  - Data retention & deletion: `malon clean` CLI command (usage prune, purge-logs, purge-index, purge-all, stats); configurable retention policies (usage_log_max_age_days, auto_prune_on_start); auto-prune on server start
  - Hosted auth infrastructure: API key management (generate, hash, validate, revoke with timing-safe comparison); session management (cryptographically random tokens, TTL, refresh, expiry); TOTP MFA (setup with recovery codes, time-windowed verification); RBAC (5 roles: admin/operator/service/user/viewer with granular permissions); SQLite-backed auth persistence with `auth_` tables
  - npm Trusted Publishing (OIDC) with provenance attestation verified and active in release pipeline
  - Written Incident Response Plan (`docs/INCIDENT_RESPONSE_PLAN.md`) with severity classification, response procedures, notification templates, and per-incident playbooks
  - DPA template (`docs/DPA_TEMPLATE.md`) covering GDPR, DPDPA 2023, and CCPA requirements with technical security measures appendix

## [0.0.1] - 2026-07-16

### Added

- Phase 1: Wedge — `malon_search`, `malon_status` MCP tools with search subagent, token accounting
- Phase 2: Security & Legal Hardening — path escape, SQL injection, shell injection protections; secret scanning; lockfile committed; install scripts disabled
- Phase 3: Free Tier Launch — `malon init`, `malon index`, rate limits, tokens-saved instrumentation, git hooks
- Phase 4: Memory & Rot — `malon_memory_write`, `malon_memory_get`, `malon_checkpoint` tools; two-rot-heuristic governor; memory auto-inject at session start; cache-friendly prompt ordering
- Phase 5: Grow — tree-sitter parsing for 6 languages (TS, JS, Python, Go, Rust, Java); file watcher with debounce; incremental re-index via git diff; 6-language parser test fixtures; performance benchmarking suite with nightly CI
