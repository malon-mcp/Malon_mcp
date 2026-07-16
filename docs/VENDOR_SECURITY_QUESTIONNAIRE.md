# Vendor Security Questionnaire — Malon

**Version:** 1.0
**Last Updated:** 2026-07-16
**Status:** Pre-drafted for enterprise prospects

---

This document contains pre-drafted answers to the most common questions
received from enterprise security review teams. It covers SOC 2, data
handling, infrastructure security, application security, incident response,
business continuity, and subprocessor relationships.

---

## Table of Contents

1. [Company Overview](#1-company-overview)
2. [SOC 2 & Compliance](#2-soc-2--compliance)
3. [Data Security & Privacy](#3-data-security--privacy)
4. [Infrastructure Security](#4-infrastructure-security)
5. [Application Security](#5-application-security)
6. [Authentication & Access Control](#6-authentication--access-control)
7. [Incident Response](#7-incident-response)
8. [Business Continuity & Disaster Recovery](#8-business-continuity--disaster-recovery)
9. [Subprocessors & Third Parties](#9-subprocessors--third-parties)
10. [SDLC & Change Management](#10-sdlc--change-management)
11. [Vulnerability Management](#11-vulnerability-management)
12. [Secure Development Training](#12-secure-development-training)

---

## 1. Company Overview

### Q1.1: Describe your company and product.

**Answer:** Malon is a local-first Model Context Protocol (MCP) server that
sits between a developer's existing AI coding agent and their codebase. It
isolates noisy search into a cheap subagent, persists a memory ledger in
git-tracked markdown, detects context rot, and shows developers what a task
will cost before it runs — and how many tokens it saved versus a naive baseline.

Malon is **not** another coding agent. It does not call the LLM API to generate
code. The primary agent's generation calls go straight to the provider. Malon only
intercepts the "figure out the codebase" work.

### Q1.2: Who are your target customers?

**Answer:** Individual developers, engineering teams, and enterprises that use
AI coding agents (Claude Code, Codex CLI, Cursor, Windsurf, Aider, etc.) and
want to improve those agents' effectiveness while reducing token spend and
maintaining data sovereignty.

### Q1.3: What is your business model?

**Answer:** Malon is open-source (MIT license) with a premium tier for
enterprise features (SSO, audit logging, team-shared memory, hosted deployment).
The local-first core is always free.

---

## 2. SOC 2 & Compliance

### Q2.1: Do you have a SOC 2 Type I or Type II report?

**Answer:** Malon is currently pursuing SOC 2 Type I readiness. Our controls
framework is documented and mapped to the AICPA Trust Services Criteria
(Security, Availability, Processing Integrity, Confidentiality, Privacy).
We expect to complete the Type I audit within [timeline]. The controls
documentation is available at `docs/SOC2_READINESS.md` in our repository.

### Q2.2: What compliance frameworks do you adhere to?

**Answer:**

- **SOC 2 Type I:** In progress (controls documented, readiness assessment complete)
- **GDPR:** Data Processing Agreement template available (`docs/DPA_TEMPLATE.md`)
- **DPDPA 2023 (India):** Compliant — incident reporting, consent management,
  data localization provisions met
- **CCPA:** Compliant — privacy policy at `PRIVACY.md`

### Q2.3: Can you provide a signed NDA?

**Answer:** Yes. Please contact `security@yourdomain` with your standard NDA
template. We will countersign within 2 business days.

---

## 3. Data Security & Privacy

### Q3.1: What data does Malon collect?

**Answer:**

| Data Category        | Collected?      | Details                                                                                                               |
| -------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Source code content  | Yes (transient) | Indexed file contents stored locally in SQLite FTS5; short spans sent to configured LLM when answering search queries |
| Repository structure | Yes (local)     | File paths, symbol names, import graphs — all local                                                                   |
| User credentials     | Yes (local)     | API keys (SHA-256 hashed), session tokens (SHA-256 hashed), MFA recovery codes (hashed)                               |
| Telemetry            | No by default   | Opt-in; aggregate events only (no code content, no file paths)                                                        |
| Personal data        | Minimal         | Email for security contact; GitHub username for attribution                                                           |
| Payment data         | None            | Not collected (premium tier uses existing provider billing)                                                           |

### Q3.2: Where is data stored?

**Answer:**

| Data          | Storage Location                            | Encryption                                    |
| ------------- | ------------------------------------------- | --------------------------------------------- |
| Code index    | `.malon/index.db` (local SQLite, WAL mode)  | Disk-level encryption via OS                  |
| Memory ledger | `.malon/memory/` (git-tracked markdown)     | Git-level + disk-level                        |
| Usage log     | `.malon/usage.log` (JSON-lines, gitignored) | Disk-level encryption via OS                  |
| Auth data     | SQLite within `.malon/`                     | SHA-256 hashed secrets; disk-level encryption |

All data resides on the user's machine. No cloud storage is used by default.

### Q3.3: Is data encrypted in transit and at rest?

**Answer:**

- **In transit (cloud mode):** All LLM API calls use HTTPS/TLS 1.3. No other
  outbound calls are made by default.
- **In transit (local mode):** Data never leaves the machine.
- **At rest:** Malon relies on the host operating system's disk encryption
  (BitLocker, FileVault, LUKS). All secrets in the auth store are hashed
  before storage.

### Q3.4: Can I run Malon entirely offline?

**Answer:** Yes. With the local-only mode (`malon init --local`), Malon uses
Ollama with a local open-weight model. No data — not a single token — leaves
the machine. This is a first-class, documented configuration path, not an
undocumented workaround.

### Q3.5: How long do you retain data?

**Answer:**

| Data          | Retention                              | Configurable?                            |
| ------------- | -------------------------------------- | ---------------------------------------- |
| Code index    | Until `malon reset` or index rebuild   | Yes (ignore patterns in config)          |
| Memory ledger | Permanent (git-tracked)                | User manages via git                     |
| Usage log     | 30 days rolling by default             | Yes (`retention.usage_log_max_age_days`) |
| Auth data     | Until key revocation or session expiry | Yes (`auth.session_ttl_minutes`)         |

---

## 4. Infrastructure Security

### Q4.1: Where is your infrastructure hosted?

**Answer:** Malon is a **local-first** application. There is no Malon-hosted
cloud infrastructure by default. The MCP server runs on the user's machine as
a Node.js process.

The premium tier (hosted memory sync, team features) will be hosted on AWS/GCP
with SOC 2-compliant controls. This is not yet available.

### Q4.2: What logging and monitoring do you have?

**Answer:**

- **Application logs:** Structured JSON to stderr (4 levels: error, warn, info, debug)
- **Usage audit trail:** `.malon/usage.log` — per-call record with query hash,
  token count, cost, latency
- **Authentication events:** Every key generation, revocation, and auth failure
  is logged
- **CI/CD monitoring:** GitHub Actions logs for lint, typecheck, test, security,
  and build workflows

### Q4.3: How do you handle secrets?

**Answer:**

1. **No secrets in code.** API keys are loaded from environment variables or
   config files (gitignored).
2. **Hashed storage.** API keys and session tokens are SHA-256 hashed before
   storage. The raw key is shown exactly once at creation.
3. **Timing-safe comparison.** Key verification uses `crypto.timingSafeEqual`.
4. **Pre-commit scanning.** Gitleaks scans every commit locally.
5. **CI scanning.** TruffleHog verification scanning on every PR.
6. **Scheduled scanning.** Weekly full-history TruffleHog and Gitleaks scans.
7. **Memory write scanning.** `malon_memory_write` is scanned for secrets before
   persistence (5th defense layer).
8. **`.env` is gitignored.** Always.

---

## 5. Application Security

### Q5.1: What security testing do you perform?

**Answer:**

| Test Type                | Frequency             | Tool/Method                                                    |
| ------------------------ | --------------------- | -------------------------------------------------------------- |
| Static analysis (SAST)   | Every PR              | Semgrep (7 custom rules + `p/security-audit` + `p/typescript`) |
| Dynamic analysis         | Nightly (benchmarks)  | Integration test suite                                         |
| Dependency scanning      | Every PR              | `npm audit`, license-checker                                   |
| Secret scanning          | Pre-commit + every PR | Gitleaks, TruffleHog                                           |
| Path traversal testing   | Every PR              | Security test suite (release gate)                             |
| SQL injection testing    | Every PR              | Security test suite (release gate)                             |
| Shell injection testing  | Every PR              | Security test suite (release gate)                             |
| Prompt injection testing | Every PR              | Security test suite (release gate)                             |
| Fuzz testing             | Quarterly             | Manual boundary-value analysis                                 |
| Penetration testing      | Annual                | External firm (planned for premium tier)                       |

### Q5.2: How do you prevent prompt injection?

**Answer:** Per AGENTS.md §7.5, prompt injection mitigation is multi-layered:

1. **Structured output.** The Subagent's output is a JSON schema, not free text.
   Schema-validated spans are not an injection vehicle.
2. **Data/instruction separation.** File content is wrapped in
   `<untrusted_repo_content>` blocks in the prompt, never inline with instructions.
3. **Pattern stripping.** Lines matching known injection patterns are stripped
   from file content before reaching the Subagent.
4. **Out-of-band verification for writes.** `malon_memory_write` validates
   proposed content before persistence.
5. **Subagent-to-primary isolation.** The Subagent's intermediate reasoning is
   dropped after the response is constructed; it never reaches the primary agent.

### Q5.3: How do you prevent path traversal?

**Answer:** Every filesystem operation goes through `src/util/paths.ts`'s
`resolveInside()` function, which:

1. Resolves both the repo root and the requested path to absolute paths
2. Calls `fs.realpath()` on both to resolve symlinks
3. Computes the relative path and rejects any that starts with `..` or is
   absolute
4. Handles the "file doesn't exist yet" case by walking up to the first
   existing ancestor

This is enforced by a release-gate test (`test/security/path-escape.test.ts`)
with 7 test cases covering `../`, absolute paths, symlinks, and edge cases.

### Q5.4: How do you handle SQL injection?

**Answer:** All SQL queries use parameterized statements. The `src/util/sql.ts`
helper enforces tagged-template SQL construction with bound parameters only.
No runtime concatenation of user input into SQL strings is permitted. FTS5
queries additionally go through `src/search/fts5-sanitize.ts` which strips
operators and caps length at 256 characters.

A Semgrep rule (`no-sql-concatenation`) and a release-gate test
(`test/security/sql-injection.test.ts`) enforce this.

---

## 6. Authentication & Access Control

### Q6.1: What authentication methods do you support?

**Answer:**

| Method         | Status       | Details                                                            |
| -------------- | ------------ | ------------------------------------------------------------------ |
| API keys       | Shipped      | `mal_` prefix, 32-byte random, SHA-256 hashed, timing-safe compare |
| Session tokens | Shipped      | 48-byte random, base64url, configurable TTL                        |
| TOTP MFA       | Shipped      | SHA-1, 30s window, +/-1 skew, 8 recovery codes                     |
| RBAC           | Shipped      | 5 roles (admin/operator/service/user/viewer), 12 permissions       |
| SSO/SAML       | Premium tier | Planned for enterprise customers                                   |

### Q6.2: What is your password policy?

**Answer:** Malon does not use passwords. Authentication is via API keys
(cryptographically random, 32 bytes) or session tokens (48 bytes random).
MFA is available and can be enforced via `auth.mfa_enforced: true`.

### Q6.3: What is your session management policy?

**Answer:**

- Session tokens are 48 bytes of cryptographic randomness
- Tokens are hashed (SHA-256) before storage — never stored in plaintext
- Configurable TTL (default: 24 hours)
- Refresh extends TTL from refresh time
- Expired sessions are pruned on server start

---

## 7. Incident Response

### Q7.1: Do you have an incident response plan?

**Answer:** Yes. The full plan is at `docs/INCIDENT_RESPONSE_PLAN.md` and covers:

- Severity classification (P0–P3) with SLA tables
- Response team with roles and responsibilities
- Full procedure from detection through post-incident
- Communication templates (reporter acknowledgment, customer notification,
  regulatory filing)
- Playbooks for specific incident types (supply chain compromise, path
  traversal, credential leak, denial of service)
- CERT-In 6-hour clock compliance (Indian data breach notification)
- Quarterly tabletop exercise requirement

### Q7.2: What is your incident response SLA?

| Severity      | Response Time | Containment | Fix          |
| ------------- | ------------- | ----------- | ------------ |
| P0 (Critical) | Immediate     | < 1 hour    | < 4 hours    |
| P1 (High)     | < 1 hour      | < 4 hours   | < 24 hours   |
| P2 (Medium)   | < 4 hours     | < 24 hours  | < 7 days     |
| P3 (Low)      | < 24 hours    | N/A         | Next release |

### Q7.3: How can I report a security issue?

**Answer:** Email `security@yourdomain`. We acknowledge within 24 hours and
triage within 72 hours. We follow coordinated disclosure with a 90-day default
window. Our `security.txt` is at `.well-known/security.txt`.

---

## 8. Business Continuity & Disaster Recovery

### Q8.1: What is your backup strategy?

**Answer:**

| Data          | Backup Method                              | RPO         | RTO         |
| ------------- | ------------------------------------------ | ----------- | ----------- |
| Code index    | None (regenerable via `malon init`)        | N/A         | N/A         |
| Memory ledger | Git-tracked (user's existing git workflow) | Per commit  | Git restore |
| Usage log     | None (ephemeral, 30-day retention)         | 30 days max | N/A         |
| Auth data     | SQLite backup on server stop               | N/A         | N/A         |

The index.db is explicitly regenerable — it is gitignored by design.
The memory ledger is git-tracked, so users get version history for free.

### Q8.2: What is your disaster recovery plan?

**Answer:** Because Malon is local-first, disaster recovery is primarily the
user's responsibility (git for memory, re-index for code). For the premium
hosted tier (future), we will maintain:

- Multi-region deployment (active-active)
- Automated failover with < 5 minute RTO
- Continuous backup with point-in-time recovery
- Annual DR testing

---

## 9. Subprocessors & Third Parties

### Q9.1: List all subprocessors.

**Answer:**

| Subprocessor               | Service                                 | Data Access         | Location      |
| -------------------------- | --------------------------------------- | ------------------- | ------------- |
| Anthropic (optional)       | LLM provider for Search Subagent        | Short code spans    | US (API)      |
| OpenAI (optional)          | LLM provider for Search Subagent        | Short code spans    | US (API)      |
| Google (Gemini — optional) | LLM provider for Search Subagent        | Short code spans    | US (API)      |
| Ollama (optional)          | Local LLM provider                      | None (local)        | Local machine |
| GitHub                     | Source code hosting, CI/CD, npm publish | Repository metadata | US            |
| npm Registry               | Package distribution                    | Package metadata    | Global CDN    |

### Q9.2: How do you vet subprocessors?

**Answer:**

- **LLM providers:** Selected based on published security practices, data
  retention policies, and SOC 2 reports. Contracts prohibit training on API
  data for Anthropic/OpenAI. Users can switch providers or go fully local
  (Ollama) at any time.
- **GitHub/npm:** Industry-standard platforms with SOC 2 compliance.
  Trusted Publishing (OIDC) is used for npm — no long-lived tokens.
- **No default telemetry:** We do not use analytics SDKs, session recording,
  or error reporting tools by default.

---

## 10. SDLC & Change Management

### Q10.1: Describe your software development lifecycle.

**Answer:** Malon follows a structured SDLC with spec-driven development:

```
SPECIFY → PLAN → TASKS → IMPLEMENT → REVIEW → MERGE → DEPLOY → VERIFY
```

1. **Specify:** Requirements are written as structured specs before code.
2. **Plan:** Technical implementation plan with dependency graph.
3. **Tasks:** Discrete, ordered tasks with acceptance criteria.
4. **Implement:** Test-driven development with incremental slices.
5. **Review:** Five-axis code review (correctness, readability, architecture,
   security, performance).
6. **Merge:** Human-reviewed PR required. No direct pushes to `main`.
7. **Deploy:** Automated CI/CD with staged rollout for significant changes.
8. **Verify:** Monitoring, health checks, and regression tests.

### Q10.2: How do you manage changes?

**Answer:** See `docs/CHANGE_MANAGEMENT_PROCESS.md` for the full process.
Summary:

| Change Class   | Examples                   | Review Required | Approval    |
| -------------- | -------------------------- | --------------- | ----------- |
| C0 (Emergency) | Security patch, outage fix | Founder (async) | Founder     |
| C1 (Standard)  | Feature, dependency update | Founder         | Founder     |
| C2 (Minor)     | Bug fix, test update       | Any engineer    | PR approval |
| C3 (Admin)     | Formatting, CI             | Optional        | Self-merge  |

### Q10.3: How do you ensure code quality?

**Answer:** Multiple quality gates, enforced in CI:

- **TypeScript strict mode** — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **ESLint** — `typescript-eslint` strict ruleset
- **Prettier** — Auto-formatting, checked in CI
- **Unit tests** — `node:test` + `node:assert/strict`
- **Integration tests** — Per-MCP-tool end-to-end tests
- **Security tests** — Release gate (8 test files, 70+ assertions)
- **Benchmark tests** — Nightly regression comparison
- **Code review** — Five-axis model, mandatory for all merges

---

## 11. Vulnerability Management

### Q11.1: How do you manage vulnerabilities?

**Answer:**

1. **Dependency scanning:** `npm audit` on every PR (hard fail on high/critical).
   Weekly Dependabot updates with 7-day cooldown for new versions.
2. **Static analysis:** Semgrep on every PR with 7 custom rules targeting
   injection, path traversal, and SQL injection patterns.
3. **Secret scanning:** Gitleaks (pre-commit), TruffleHog (CI, verified findings),
   weekly full-history scan.
4. **Remediation SLA:**

| Severity | Fix Time     | Release Channel    |
| -------- | ------------ | ------------------ |
| Critical | < 24 hours   | Emergency patch    |
| High     | < 7 days     | Next release       |
| Moderate | < 30 days    | Next minor release |
| Low      | Next release | —                  |

5. **Disclosure:** Coordinated disclosure with 90-day default window.
   `security.txt` published at `.well-known/security.txt`.

### Q11.2: Do you have a bug bounty program?

**Answer:** Not at this time. We accept and acknowledge all responsible
disclosures via `security@yourdomain`.

---

## 12. Secure Development Training

### Q12.1: How do you ensure developers follow secure coding practices?

**Answer:**

- **Automated enforcement:** Security rules are encoded in Semgrep, ESLint,
  and the security test suite — they are not dependent on human vigilance.
- **Pre-commit hooks:** Gitleaks + Prettier + fast security tests run on
  every commit locally.
- **CI gates:** Security tests are a hard release gate. The PR cannot merge
  if they fail.
- **Threat model:** `malon-threat-model.mmd` is versioned and reviewed on
  every architecture change.
- **AGENTS.md:** The agent's operating manual (§2, §7, §20) codifies security
  patterns for the AI agent that writes the majority of the codebase.

---

## Appendix A: Standard Questionnaire Quick Reference

| Question                  | Short Answer                                                    | Detail Section |
| ------------------------- | --------------------------------------------------------------- | -------------- |
| SOC 2?                    | In progress                                                     | §2.1           |
| Data encryption?          | TLS 1.3 in transit; disk-level at rest                          | §3.3           |
| Offline capable?          | Yes — `malon init --local`                                      | §3.4, §Q3.4    |
| Pen test performed?       | Annual (planned for premium)                                    | §5.1           |
| Vulnerability disclosure? | `security@yourdomain`, 90-day window                            | §7.3, §11.1    |
| Subprocessors?            | Anthropic/OpenAI/Gemini (optional), Ollama (local), GitHub, npm | §9.1           |
| Data retention?           | 30 days rolling for usage logs; permanent for memory            | §3.5           |
| Auth methods?             | API keys, session tokens, TOTP MFA, RBAC                        | §6.1           |
| Security testing?         | SAST, DAST, dependency scan, secret scan — every PR             | §5.1           |
| Incident response SLA?    | P0 < 1 hour, P1 < 4 hours, P2 < 24 hours                        | §7.2           |
| Training?                 | Automated enforcement, threat model, AGENTS.md                  | §12.1          |
| Deletion process?         | `malon reset` + `malon clean purge-all`                         | §3.5           |

---

## Appendix B: Acronyms

| Acronym | Expansion                                          |
| ------- | -------------------------------------------------- |
| CCPA    | California Consumer Privacy Act                    |
| DAST    | Dynamic Application Security Testing               |
| DPA     | Data Processing Agreement                          |
| DPDPA   | Digital Personal Data Protection Act (India, 2023) |
| GDPR    | General Data Protection Regulation                 |
| MCP     | Model Context Protocol                             |
| MFA     | Multi-Factor Authentication                        |
| OIDC    | OpenID Connect                                     |
| RBAC    | Role-Based Access Control                          |
| RPO     | Recovery Point Objective                           |
| RTO     | Recovery Time Objective                            |
| SAST    | Static Application Security Testing                |
| SDLC    | Software Development Lifecycle                     |
| SOC     | Service Organization Control                       |
| TOTP    | Time-based One-Time Password                       |

---

## Version History

| Date       | Version | Author | Changes                           |
| ---------- | ------- | ------ | --------------------------------- |
| 2026-07-16 | 1.0     | Agent  | Initial pre-drafted questionnaire |

---

_This document is versioned in the Malon repository at
`docs/VENDOR_SECURITY_QUESTIONNAIRE.md`. It is a living document — answers
should be reviewed and updated quarterly or after any significant security
control change._

_Send completed versions to prospects as `Malon_Vendor_Security_Questionnaire_v1.0.pdf`_
