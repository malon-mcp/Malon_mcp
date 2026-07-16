# SOC 2 Type I Readiness — Malon

**Version:** 1.0
**Last Updated:** 2026-07-16
**Status:** Pre-audit readiness assessment
**Classification:** Internal — Enterprise

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [System Description](#2-system-description)
3. [Trust Services Criteria Coverage](#3-trust-services-coverage)
4. [Control Activities — Security](#4-control-activities--security)
5. [Control Activities — Availability](#5-control-activities--availability)
6. [Control Activities — Processing Integrity](#6-control-activities--processing-integrity)
7. [Control Activities — Confidentiality](#7-control-activities--confidentiality)
8. [Control Activities — Privacy](#8-control-activities--privacy)
9. [Evidence Collection Framework](#9-evidence-collection-framework)
10. [Readiness Gap Analysis](#10-readiness-gap-analysis)
11. [Audit Preparation Checklist](#11-audit-preparation-checklist)
12. [Key Personnel and Responsibilities](#12-key-personnel-and-responsibilities)
13. [Timeline and Milestones](#13-timeline-and-milestones)

---

## 1. Purpose

This document assesses Malon's readiness for a SOC 2 Type I audit against the
AICPA Trust Services Criteria. It maps every applicable criterion to a specific
control activity in the Malon system, identifies the evidence that demonstrates
the control is suitably designed, and flags gaps that must be addressed before
an auditor engagement.

**Scope of the SOC 2 examination:** The Malon MCP server (version 0.6.0+),
including:

- The local MCP server binary (installed via npm)
- The Search Subagent and Index & Graph Service
- The Memory Ledger (`.malon/memory/`)
- The Auth subsystem (API keys, sessions, MFA, RBAC)
- The CLI (`malon init`, `malon status`, etc.)
- CI/CD pipeline (GitHub Actions, npm publish)

**Excluded from scope:**

- User's codebase content (out of Malon's control)
- User's git history and workflow
- Third-party LLM provider infrastructure
- User's local machine security

---

## 2. System Description

### 2.1 Overview

Malon is a local-first MCP server that sits between a developer's AI coding
agent and their codebase. It performs four functions:

1. **Search isolation:** Intercepts code-search queries and routes them through
   a cheap subagent that returns only the 1-3 relevant file spans
2. **Memory persistence:** Maintains a git-tracked markdown ledger of decisions,
   conventions, and session summaries
3. **Context rot detection:** Monitors context size and re-read patterns,
   triggering checkpoints before model degradation
4. **Cost governance:** Tracks token spend, computes savings vs. baseline, and
   enforces user-set ceilings

### 2.2 Boundaries

| Boundary         | In Scope                                   | Out of Scope                           |
| ---------------- | ------------------------------------------ | -------------------------------------- |
| Application code | Malon MCP server, CLI, Subagent            | User's codebase                        |
| Infrastructure   | User's local machine                       | Cloud hosting, LLM provider infra      |
| Data             | Index, memory, auth store, usage log       | User's source code content (transient) |
| People           | Founder, agent/engineer                    | End users                              |
| Processes        | SDLC, change management, incident response | User's internal processes              |

### 2.3 Key Components

| Component       | Description                                    | Controls           |
| --------------- | ---------------------------------------------- | ------------------ |
| `src/server/`   | MCP server entrypoint (stdio transport)        | CC1, CC2, CC3, CC5 |
| `src/search/`   | Search Subagent — LLM-powered retrieval        | CC4, CC6, CC7      |
| `src/index/`    | Index & Graph Service — SQLite + tree-sitter   | CC6, CC7, PI1      |
| `src/memory/`   | Memory Ledger — git-tracked markdown           | CC6, CC7, CC8      |
| `src/governor/` | Cost & Rot Governor — usage tracking           | CC3, CC5, CC9      |
| `src/auth/`     | Authentication — API keys, sessions, MFA, RBAC | CC1, CC2, CC6      |
| `src/cli/`      | CLI surface — init, status, reset, clean       | CC6, CC7           |
| CI/CD           | GitHub Actions — test, build, publish          | CC1, CC2, CC3, CC5 |

---

## 3. Trust Services Criteria Coverage

This section maps the AICPA Trust Services Criteria (2023) to specific Malon
controls. Each criterion is marked as:

- ✅ **Fully covered** — Control exists, documented, tested, and evidence is
  available
- ⚠️ **Partially covered** — Control exists but needs strengthening or
  evidence gaps remain
- ❌ **Not covered** — Control needs to be implemented before audit

### 3.1 Security (CC Series)

| Criteria  | Description                                        | Coverage | Key Controls                                                                   |
| --------- | -------------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| **CC1.0** | Control Environment                                | ⚠️       | Ethics policy, org structure, Board oversight (see §10)                        |
| **CC1.1** | Integrity and ethical values                       | ✅       | AGENTS.md §22, code of conduct in PRIVACY.md/TERMS.md                          |
| **CC1.2** | Board oversight                                    | ❌       | No formal board; founder is sole decision-maker (see §10)                      |
| **CC1.3** | Organizational structure                           | ✅       | AGENTS.md §22 (founder/agent roles defined)                                    |
| **CC1.4** | Competence of personnel                            | ⚠️       | Automated enforcement via tests; no formal training program                    |
| **CC1.5** | Accountability                                     | ✅       | RBAC roles (admin/operator/service/user/viewer), PR review requirements        |
| **CC2.0** | Communication and Information                      | ✅       | AGENTS.md §22.4 (PR format), §22.5 (progress reporting)                        |
| **CC2.1** | Information system objectives                      | ✅       | Architecture docs (AGENTS.md §3, Execution.md)                                 |
| **CC2.2** | Internal communication                             | ✅       | PR descriptions, CHANGELOG, commit messages                                    |
| **CC2.3** | External communication                             | ✅       | SECURITY.md, PRIVACY.md, security.txt, docs/                                   |
| **CC3.0** | Risk Assessment                                    | ⚠️       | Threat model exists (malon-threat-model.mmd); no formal RA process             |
| **CC3.1** | Risk identification                                | ✅       | malon-threat-model.mmd, AGENTS.md §7 (security deep dive)                      |
| **CC3.2** | Risk analysis                                      | ✅       | CVSS-based severity, threat model STRIDE approach                              |
| **CC3.3** | Risk response                                      | ✅       | Incident response plan (docs/INCIDENT_RESPONSE_PLAN.md)                        |
| **CC3.4** | Risk monitoring                                    | ⚠️       | No continuous risk monitoring; periodic review                                 |
| **CC4.0** | Monitoring Activities                              | ✅       | CI/CD pipeline, security tests, benchmark regression                           |
| **CC4.1** | Ongoing monitoring                                 | ✅       | Every PR runs full CI (lint, typecheck, test, security, build)                 |
| **CC4.2** | Independent evaluations                            | ⚠️       | No external penetration testing yet; planned for premium tier                  |
| **CC4.3** | Remediation                                        | ✅       | Bug fix → regression test cycle; incident response procedure                   |
| **CC5.0** | Control Activities                                 | ✅       | Comprehensive controls across all 5 TSC categories                             |
| **CC5.1** | Control activities integrated with risk assessment | ✅       | Path traversal, SQL injection, shell injection controls mapped to threats      |
| **CC5.2** | Selection and development of control activities    | ✅       | AGENTS.md §2 (non-negotiables), §7 (security deep dive)                        |
| **CC5.3** | Technology controls                                | ✅       | Parameterized SQL, execFile-only, path canonicalization, secret scanning       |
| **CC5.4** | Control activities through policies                | ✅       | AGENTS.md, docs/ACCESS_CONTROL_POLICY, docs/CHANGE_MANAGEMENT_PROCESS          |
| **CC6.0** | Logical and Physical Access                        | ✅       | API keys, sessions, MFA, RBAC — all implemented                                |
| **CC6.1** | Logical access security                            | ✅       | API key hashing, timing-safe compare, session token entropy                    |
| **CC6.2** | User access provisioning                           | ✅       | Admin-generated API keys; immediate revocation                                 |
| **CC6.3** | Access to data and programs                        | ✅       | RBAC with 5 roles, 12 permissions, tool-level boundaries                       |
| **CC6.4** | Physical access                                    | N/A      | Local-first; no Malon-managed physical infrastructure                          |
| **CC6.5** | Removal of access                                  | ✅       | Immediate key revocation; session TTL in config                                |
| **CC6.6** | Authentication                                     | ✅       | API keys (44-char base64url), TOTP MFA, session tokens                         |
| **CC6.7** | Authorization                                      | ✅       | RBAC enforced in code (`src/auth/rbac.ts`)                                     |
| **CC6.8** | Security of data and programs in development       | ✅       | Isolated branches, PR review, CI/CD gates                                      |
| **CC7.0** | System Operations                                  | ✅       | Incident response plan, monitoring, logging                                    |
| **CC7.1** | Detection of vulnerabilities                       | ✅       | SAST (Semgrep), dependency scan (npm audit), secret scan (Gitleaks/TruffleHog) |
| **CC7.2** | Response to incidents                              | ✅       | docs/INCIDENT_RESPONSE_PLAN.md with severity classification                    |
| **CC7.3** | Recovery from incidents                            | ✅       | Rollback plans, revert strategy, postmortem process                            |
| **CC7.4** | System monitoring                                  | ✅       | Structured logging (stderr JSON), usage.log audit trail                        |
| **CC7.5** | Monitoring of processing                           | ✅       | Rot Governor (context size, re-read counts), benchmark regression              |
| **CC8.0** | Change Management                                  | ✅       | docs/CHANGE_MANAGEMENT_PROCESS.md                                              |
| **CC8.1** | Changes to system                                  | ✅       | C0-C3 classification, spec-driven development, PR review                       |
| **CC8.2** | Changes to programs                                | ✅       | Dependency management (§2.6), lockfile verification                            |
| **CC8.3** | Changes to data                                    | ✅       | Memory ledger append-only, schema migrations versioned                         |
| **CC8.4** | System changes communicated                        | ✅       | CHANGELOG.md, README.md, PR descriptions                                       |
| **CC9.0** | Risk Mitigation                                    | ⚠️       | Controls in place; no formal BCP/DRP for local-first core                      |

### 3.2 Availability (A Series)

| Criteria | Description         | Coverage | Key Controls                                                   |
| -------- | ------------------- | -------- | -------------------------------------------------------------- |
| **A1.0** | Availability        | ✅       | Local-first; no external dependency for core functionality     |
| **A1.1** | Capacity management | ✅       | Resource caps (subagent timeout, output bytes, memory)         |
| **A1.2** | Backup and recovery | ⚠️       | Memory git-tracked; index regenerable; no formal backup policy |
| **A1.3** | Disaster recovery   | ⚠️       | See §10 for BCP/DRP gap                                        |

### 3.3 Processing Integrity (PI Series)

| Criteria  | Description          | Coverage | Key Controls                                                     |
| --------- | -------------------- | -------- | ---------------------------------------------------------------- |
| **PI1.0** | Processing Integrity | ✅       | All input validated, output schema-enforced                      |
| **PI1.1** | Completeness         | ✅       | FTS5 indexing covers all non-ignored files; incremental re-index |
| **PI1.2** | Accuracy             | ✅       | tree-sitter parsing; validated output schema; security tests     |
| **PI1.3** | Timeliness           | ✅       | Incremental re-index on commit; fs.watch for non-git repos       |
| **PI1.4** | Authorization        | ✅       | RBAC on every tool call; malon_search read-only by design        |

### 3.4 Confidentiality (C Series)

| Criteria | Description                         | Coverage | Key Controls                                                          |
| -------- | ----------------------------------- | -------- | --------------------------------------------------------------------- |
| **C1.0** | Confidentiality                     | ✅       | Local-first core; no cloud storage; opt-in telemetry                  |
| **C1.1** | Identification of confidential info | ✅       | .gitignore excludes .env, *.key, *.pem; secret scanning on writes     |
| **C1.2** | Protection of confidential info     | ✅       | Local-only mode (Ollama); hashed secrets; data/instruction separation |
| **C1.3** | Retention of confidential info      | ✅       | Configurable retention (default 30d); purge commands available        |
| **C1.4** | Disposal of confidential info       | ✅       | `malon reset` + `malon clean purge-all`                               |

### 3.5 Privacy (P Series)

| Criteria | Description                | Coverage | Key Controls                                              |
| -------- | -------------------------- | -------- | --------------------------------------------------------- |
| **P1.0** | Privacy                    | ✅       | PRIVACY.md, TERMS.md, DPA_TEMPLATE.md                     |
| **P1.1** | Notice                     | ✅       | PRIVACY.md published; telemetry opt-in and documented     |
| **P1.2** | Choice and consent         | ✅       | Telemetry default-off; provider selection user-controlled |
| **P1.3** | Collection                 | ✅       | Minimal data collection documented in PRIVACY.md          |
| **P1.4** | Use and retention          | ✅       | Configurable retention; usage log gitignored              |
| **P1.5** | Access                     | ✅       | Users control all data via filesystem                     |
| **P1.6** | Disclosure                 | ✅       | No third-party disclosure by default                      |
| **P1.7** | Quality                    | ✅       | Data validated at boundaries                              |
| **P1.8** | Monitoring and enforcement | ✅       | Secret scanning before memory writes; pre-commit hooks    |

---

## 4. Control Activities — Security

### CC1: Control Environment

| Control ID | Control Activity                                  | Owner          | Evidence                                                  |
| ---------- | ------------------------------------------------- | -------------- | --------------------------------------------------------- |
| CC1-1      | Code of Conduct documented in TERMS.md            | Founder        | `TERMS.md`                                                |
| CC1-2      | Ethics and integrity standards in AGENTS.md §22   | Founder        | `AGENTS.md` §22                                           |
| CC1-3      | Organizational structure defined with clear roles | Founder        | `AGENTS.md` §22.2, `docs/ACCESS_CONTROL_POLICY.md`        |
| CC1-4      | Automated code quality enforcement (tests, lint)  | Agent/Engineer | `.github/workflows/ci.yml`, `eslint.config.js`            |
| CC1-5      | PR review required for all merges                 | Founder        | GitHub branch protection; AGENTS.md §2.7                  |
| CC1-6      | Accountability through RBAC roles                 | Agent/Engineer | `src/auth/rbac.ts`, `test/security/auth-security.test.ts` |

### CC2: Communication and Information

| Control ID | Control Activity                                | Owner   | Evidence                                  |
| ---------- | ----------------------------------------------- | ------- | ----------------------------------------- |
| CC2-1      | PR descriptions follow §22.4 format             | Agent   | PR artifacts                              |
| CC2-2      | CHANGELOG updated for user-visible changes      | Agent   | `CHANGELOG.md`                            |
| CC2-3      | Security incident communication templates exist | Agent   | `docs/INCIDENT_RESPONSE_PLAN.md` §5       |
| CC2-4      | External security contact published             | Founder | `SECURITY.md`, `.well-known/security.txt` |
| CC2-5      | Privacy policy published                        | Founder | `PRIVACY.md`                              |
| CC2-6      | DPA template available                          | Agent   | `docs/DPA_TEMPLATE.md`                    |

### CC3: Risk Assessment

| Control ID | Control Activity                               | Owner         | Evidence                                                 |
| ---------- | ---------------------------------------------- | ------------- | -------------------------------------------------------- |
| CC3-1      | Threat model maintained and versioned          | Agent         | `malon-threat-model.mmd`                                 |
| CC3-2      | STRIDE analysis applied to each trust boundary | Agent         | `malon-threat-model.mmd`, AGENTS.md §7 intro             |
| CC3-3      | CVSS-based severity for vulnerabilities        | Agent/Founder | Incident severity table (`INCIDENT_RESPONSE_PLAN.md` §2) |
| CC3-4      | Incident response plan documented              | Agent         | `docs/INCIDENT_RESPONSE_PLAN.md`                         |
| CC3-5      | Quarterly threat model review                  | Founder       | Calendar recurring event                                 |

### CC4: Monitoring Activities

| Control ID | Control Activity                                     | Owner   | Evidence                                                         |
| ---------- | ---------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| CC4-1      | CI pipeline runs on every PR                         | Agent   | `.github/workflows/ci.yml`                                       |
| CC4-2      | Security tests are a release gate                    | Agent   | `test/security/` (8 files, 70+ assertions)                       |
| CC4-3      | Dependency scanning every PR                         | Agent   | `npm audit` in CI                                                |
| CC4-4      | Secret scanning (Gitleaks pre-commit, TruffleHog CI) | Agent   | `.pre-commit-config.yaml`, `.github/workflows/security-scan.yml` |
| CC4-5      | Benchmark regression detection nightly               | Agent   | `.github/workflows/benchmark.yml`                                |
| CC4-6      | Error and usage logging to structured format         | Agent   | `src/util/log.ts`, `usage.log`                                   |
| CC4-7      | Quarterly tabletop exercise for IR                   | Founder | Incident response plan §9                                        |

### CC5: Control Activities

| Control ID | Control Activity                                 | Owner | Evidence                                                             |
| ---------- | ------------------------------------------------ | ----- | -------------------------------------------------------------------- |
| CC5-1      | No shell-string execution (`execFile` only)      | Agent | `src/util/process.ts`, Semgrep rule `no-shell-string`                |
| CC5-2      | Path canonicalization before every filesystem op | Agent | `src/util/paths.ts`, `test/security/path-escape.test.ts`             |
| CC5-3      | Parameterized SQL everywhere                     | Agent | `src/util/sql.ts`, Semgrep rule `no-sql-concatenation`               |
| CC5-4      | FTS5 query sanitization                          | Agent | `src/search/fts5-sanitize.ts`, `test/security/sql-injection.test.ts` |
| CC5-5      | Subagent timeouts and caps                       | Agent | `src/search/subagent.ts`, AGENTS.md §2.4                             |
| CC5-6      | Tool-level agency boundaries                     | Agent | AGENTS.md §2.5; each tool is structurally limited                    |
| CC5-7      | Secret scanning on memory writes                 | Agent | `src/memory/secret-scan.ts`, `test/security/secret-leak.test.ts`     |
| CC5-8      | Dependency existence verification                | Agent | AGENTS.md §2.6; manual check before `npm install`                    |

### CC6: Logical and Physical Access

| Control ID | Control Activity                                 | Owner | Evidence                                                  |
| ---------- | ------------------------------------------------ | ----- | --------------------------------------------------------- |
| CC6-1      | API key generation with cryptographic randomness | Agent | `src/auth/api-key.ts` (32 bytes, `mal_` prefix)           |
| CC6-2      | Secure key storage (SHA-256 hashed)              | Agent | `src/auth/api-key.ts`                                     |
| CC6-3      | Timing-safe key comparison                       | Agent | `src/auth/api-key.ts:verifyApiKey()`                      |
| CC6-4      | Session token with cryptographic entropy         | Agent | `src/auth/session.ts` (48 bytes random)                   |
| CC6-5      | TOTP MFA with recovery codes                     | Agent | `src/auth/mfa.ts` (8 codes, single-use)                   |
| CC6-6      | RBAC with 5 roles, 12 permissions                | Agent | `src/auth/rbac.ts`, `test/security/auth-security.test.ts` |
| CC6-7      | Immediate key revocation                         | Agent | `src/auth/admin-handler.ts` (revoke-key operation)        |
| CC6-8      | Session TTL with refresh                         | Agent | `src/auth/session.ts` (configurable, default 24h)         |
| CC6-9      | No permanent credentials                         | Agent | All credentials have configurable TTLs                    |

### CC7: System Operations

| Control ID | Control Activity                                   | Owner | Evidence                              |
| ---------- | -------------------------------------------------- | ----- | ------------------------------------- |
| CC7-1      | Incident severity classification                   | Agent | `docs/INCIDENT_RESPONSE_PLAN.md` §2   |
| CC7-2      | Incident response procedure documented             | Agent | `docs/INCIDENT_RESPONSE_PLAN.md` §4   |
| CC7-3      | Communication templates for incident notifications | Agent | `docs/INCIDENT_RESPONSE_PLAN.md` §5   |
| CC7-4      | Post-incident postmortem process                   | Agent | `docs/INCIDENT_RESPONSE_PLAN.md` §4.5 |
| CC7-5      | Structured JSON logging to stderr                  | Agent | `src/util/log.ts`                     |
| CC7-6      | Audit trail in `usage.log`                         | Agent | `src/governor/token-accounting.ts`    |
| CC7-7      | Per-request correlation IDs (session_id UUIDv7)    | Agent | `src/orchestrator/router.ts`          |

### CC8: Change Management

| Control ID | Control Activity                        | Owner   | Evidence                                                    |
| ---------- | --------------------------------------- | ------- | ----------------------------------------------------------- |
| CC8-1      | Change classification (C0-C3)           | Agent   | `docs/CHANGE_MANAGEMENT_PROCESS.md` §2                      |
| CC8-2      | Spec-driven development for C1 changes  | Agent   | `tasks/` directory, AGENTS.md spec-driven-development skill |
| CC8-3      | Mandatory PR review for all merges      | Founder | GitHub branch protection; AGENTS.md §2.7                    |
| CC8-4      | Full CI suite on every PR               | Agent   | `.github/workflows/ci.yml` (10 jobs)                        |
| CC8-5      | Dependency review process               | Agent   | AGENTS.md §2.6, `docs/CHANGE_MANAGEMENT_PROCESS.md` §6      |
| CC8-6      | Lockfile committed; `npm ci` in CI      | Agent   | `package-lock.json` committed                               |
| CC8-7      | Migration versioning for schema changes | Agent   | `src/index/schema.ts`, `src/index/migrations/`              |

### CC9: Risk Mitigation

| Control ID | Control Activity                                         | Owner | Evidence                                                |
| ---------- | -------------------------------------------------------- | ----- | ------------------------------------------------------- |
| CC9-1      | Business continuity considerations documented            | Agent | `docs/SOC2_READINESS.md` §10 (gap analysis)             |
| CC9-2      | Local-first architecture minimizes external dependencies | Agent | `src/server/index.ts` — no external service requirement |
| CC9-3      | Rollback plan documented per change                      | Agent | PR descriptions, `docs/CHANGE_MANAGEMENT_PROCESS.md` §7 |
| CC9-4      | Regenerable index (no single point of failure)           | Agent | `src/cli/init.ts`, `src/cli/reset.ts`                   |

---

## 5. Control Activities — Availability

| Control ID | Control Activity                                        | Owner | Evidence                                                |
| ---------- | ------------------------------------------------------- | ----- | ------------------------------------------------------- |
| A1-1       | Local-first operation — no external dependency for core | Agent | `src/server/index.ts`                                   |
| A1-2       | Resource caps prevent DoS (subagent timeout, memory)    | Agent | AGENTS.md §2.4; `src/search/subagent.ts`                |
| A1-3       | Memory ledger git-tracked (versioned backup)            | Agent | `.malon/memory/` — user's git provides backup           |
| A1-4       | Index regenerable via `malon init`                      | Agent | `src/cli/init.ts`                                       |
| A1-5       | Usage log auto-prune prevents disk exhaustion           | Agent | `src/governor/retention.ts`                             |
| A1-6       | Graceful degradation on LLM provider failure            | Agent | `src/search/subagent.ts` (5xx retry, returns not_found) |

---

## 6. Control Activities — Processing Integrity

| Control ID | Control Activity                                      | Owner | Evidence                                                 |
| ---------- | ----------------------------------------------------- | ----- | -------------------------------------------------------- |
| PI1-1      | Input validation at every tool boundary (Zod schemas) | Agent | `src/server/index.ts` (z.string().min(1).max(512), etc.) |
| PI1-2      | Output schema validation for Subagent responses       | Agent | `src/search/subagent.ts:validateFinalAnswer()`           |
| PI1-3      | File indexing covers all non-ignored files            | Agent | `src/index/index.ts`, `.gitignore`-aware walking         |
| PI1-4      | Incremental re-index via git diff                     | Agent | `src/index/incremental.ts`                               |
| PI1-5      | tree-sitter parsing extracts accurate symbol data     | Agent | `src/index/parser.ts` (6 languages)                      |
| PI1-6      | Graceful skip on unparseable files                    | Agent | `src/index/parser.ts` — logs warning, returns empty      |
| PI1-7      | Schema versioning for forward-compatible migrations   | Agent | `src/index/schema.ts`                                    |

---

## 7. Control Activities — Confidentiality

| Control ID | Control Activity                                | Owner | Evidence                                                |
| ---------- | ----------------------------------------------- | ----- | ------------------------------------------------------- |
| C1-1       | Local-only mode (`malon init --local`)          | Agent | `src/cli/ollama.ts`, `src/cli/init.ts`                  |
| C1-2       | No data leaves machine by default in local mode | Agent | `SECURITY.md` (zero-trust section prominent)            |
| C1-3       | Opt-in telemetry only                           | Agent | `config.yml: telemetry.enabled: false` default          |
| C1-4       | .gitignore excludes .env, keys, pem files       | Agent | `.gitignore`                                            |
| C1-5       | Secret scanning before memory writes            | Agent | `src/memory/secret-scan.ts`                             |
| C1-6       | Configurable data retention                     | Agent | `src/governor/retention.ts`                             |
| C1-7       | Data purge commands available                   | Agent | `src/cli/clean.ts` (purge-logs, purge-index, purge-all) |
| C1-8       | Config file excludes sensitive patterns         | Agent | `.malon.example/config.yml` — ignore_patterns           |

---

## 8. Control Activities — Privacy

| Control ID | Control Activity                   | Owner   | Evidence                                   |
| ---------- | ---------------------------------- | ------- | ------------------------------------------ |
| P1-1       | Privacy policy published           | Founder | `PRIVACY.md`                               |
| P1-2       | DPA template available             | Agent   | `docs/DPA_TEMPLATE.md` (GDPR, DPDPA, CCPA) |
| P1-3       | Telemetry default-off              | Agent   | `config.yml: telemetry.enabled: false`     |
| P1-4       | Provider selection user-controlled | Agent   | `config.yml: search.provider`              |
| P1-5       | Data retention configurable        | Agent   | `config.yml: retention`                    |
| P1-6       | Data deletion via CLI commands     | Agent   | `src/cli/clean.ts`, `src/cli/reset.ts`     |
| P1-7       | Terms of service published         | Founder | `TERMS.md`                                 |

---

## 9. Evidence Collection Framework

### 9.1 Evidence Repository Structure

Evidence is organized under `docs/evidence/` (to be created before audit):

```
docs/evidence/
├── control-environment/
│   ├── CC1-1_code_of_conduct.md        → TERMS.md
│   ├── CC1-3_org_structure.md          → docs/ACCESS_CONTROL_POLICY.md
│   └── CC1-5_accountability.md         → src/auth/rbac.ts
├── communication/
│   ├── CC2-1_pr_format.md              → AGENTS.md §22.4
│   ├── CC2-4_security_contact.md       → SECURITY.md, .well-known/security.txt
│   └── CC2-6_dpa_template.md           → docs/DPA_TEMPLATE.md
├── risk-assessment/
│   ├── CC3-1_threat_model.md           → malon-threat-model.mmd
│   └── CC3-4_incident_response.md      → docs/INCIDENT_RESPONSE_PLAN.md
├── monitoring/
│   ├── CC4-1_ci_pipeline.md            → .github/workflows/ci.yml
│   ├── CC4-2_security_tests.md         → test/security/ (pass/fail output)
│   └── CC4-5_benchmarks.md             → benchmarks/history/
├── control-activities/
│   ├── CC5-1_no_shell_exec.md          → src/util/process.ts
│   ├── CC5-2_path_canonicalization.md  → src/util/paths.ts
│   ├── CC5-3_parameterized_sql.md      → src/util/sql.ts
│   └── CC5-5_subagent_timeouts.md      → src/search/subagent.ts
├── logical-access/
│   ├── CC6-1_api_key_generation.md     → src/auth/api-key.ts
│   ├── CC6-3_timing_safe_compare.md    → src/auth/api-key.ts
│   ├── CC6-5_totp_mfa.md              → src/auth/mfa.ts
│   └── CC6-6_rbac.md                  → src/auth/rbac.ts
├── system-operations/
│   ├── CC7-1_severity_classification.md → docs/INCIDENT_RESPONSE_PLAN.md §2
│   ├── CC7-5_structured_logging.md     → src/util/log.ts
│   └── CC7-7_correlation_ids.md        → src/orchestrator/router.ts
├── change-management/
│   ├── CC8-1_change_classification.md   → docs/CHANGE_MANAGEMENT_PROCESS.md
│   ├── CC8-2_spec_driven_dev.md        → AGENTS.md (spec-driven-development)
│   └── CC8-3_pr_review.md             → AGENTS.md §2.7
├── availability/
│   ├── A1-1_local_first.md             → src/server/index.ts
│   ├── A1-3_memory_git_tracked.md      → .malon/memory/
│   └── A1-6_graceful_degradation.md    → src/search/subagent.ts
├── processing-integrity/
│   ├── PI1-1_input_validation.md        → src/server/index.ts (Zod schemas)
│   ├── PI1-3_index_coverage.md         → src/index/index.ts
│   └── PI1-7_schema_versioning.md      → src/index/schema.ts
├── confidentiality/
│   ├── C1-1_local_mode.md              → src/cli/ollama.ts
│   ├── C1-3_telemetry_opt_in.md        → .malon.example/config.yml
│   └── C1-5_secret_scanning.md         → src/memory/secret-scan.ts
└── privacy/
    ├── P1-1_privacy_policy.md           → PRIVACY.md
    └── P1-2_dpa_template.md            → docs/DPA_TEMPLATE.md
```

### 9.2 Evidence Collection Methods

| Method                  | Description                                 | Frequency                               |
| ----------------------- | ------------------------------------------- | --------------------------------------- |
| **Code review**         | Each control maps to a specific source file | Once (before audit); updated on changes |
| **CI logs**             | GitHub Actions workflow runs                | Every PR                                |
| **Test output**         | `node --test test/security/` pass/fail      | Every commit                            |
| **Commit history**      | `git log` for change management evidence    | Continuous                              |
| **Configuration**       | `.malon/config.yml`, `.github/workflows/`   | Version-controlled                      |
| **Meeting notes**       | CRB decisions, incident reviews             | As needed                               |
| **Auditor walkthrough** | Live demonstration of control operation     | During audit                            |

### 9.3 Evidence Retention

- **Code-based evidence:** Retained in git permanently (version history)
- **CI logs:** Retained in GitHub Actions (90 days default; export before expiry)
- **Test outputs:** Retained in CI artifacts (30 days; export results)
- **Config evidence:** Retained in git permanently
- **Meeting notes:** Retained in `.malon/memory/` (git-tracked, permanent)

---

## 10. Readiness Gap Analysis

### 10.1 Identified Gaps

| Gap ID | Criteria | Gap Description                                       | Severity | Remediation                                                                             | Target    |
| ------ | -------- | ----------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- | --------- |
| GAP-01 | CC1.2    | No formal board of directors or independent oversight | Low      | Document founder-as-sole-decision-maker model; consider advisory board for premium tier | Pre-audit |
| GAP-02 | CC1.4    | No formal security training program for personnel     | Low      | Document automated enforcement as compensating control; create security awareness memo  | Pre-audit |
| GAP-03 | CC3.4    | No continuous risk monitoring program                 | Low      | Add quarterly risk review to calendar; document as periodic (acceptable for small org)  | Pre-audit |
| GAP-04 | CC4.2    | No independent penetration testing                    | Medium   | Schedule first external pen test before premium tier launch                             | Q4 2026   |
| GAP-05 | A1.2     | No formal backup policy for local data                | Low      | Document that memory is git-tracked (user's responsibility) and index is regenerable    | Pre-audit |
| GAP-06 | A1.3     | No formal disaster recovery plan                      | Low      | Document local-first architecture as inherent DR; user's git is backup                  | Pre-audit |
| GAP-07 | CC1.4    | No formal onboarding/offboarding process              | Low      | Create one-page onboarding checklist; offboarding is key revocation                     | Pre-audit |

### 10.2 Compensating Controls

For each gap, the following compensating controls reduce residual risk:

| Gap                      | Compensating Controls                                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GAP-01 (Board oversight) | Founder is sole decision-maker with direct accountability; all decisions are documented in version-controlled AGENTS.md/ADRs; automated enforcement via CI/git hooks reduces need for human oversight of routine changes |
| GAP-02 (Training)        | Security is encoded in automated checks (Semgrep, ESLint, security tests), not dependent on human training; AGENTS.md serves as the agent's "training manual" and is read on every session                               |
| GAP-03 (Risk monitoring) | Static analysis (Semgrep) + dependency scanning (npm audit) + secret scanning (Gitleaks/TruffleHog) run automatically on every change; no human-dependent risk monitoring step                                           |
| GAP-04 (Pen testing)     | Automated security tests cover all known vulnerability classes; SAST runs on every commit; annual pen test will be added before premium tier                                                                             |
| GAP-05 (Backup)          | Memory ledger is git-tracked (user's existing backup workflow); index is fully regenerable from source; usage log is ephemeral by design                                                                                 |
| GAP-06 (DR)              | Local-first architecture means no external infrastructure to recover; re-index is `malon init` away; git restore recovers memory                                                                                         |

### 10.3 Risk Acceptance

The following gaps are accepted as inherent to the local-first, early-stage
nature of the product:

- **Board oversight (GAP-01):** Accepted. The founder is the accountable owner
  of the control environment. An advisory board will be formed before the
  premium tier launch.
- **Pen testing (GAP-04):** Accepted until premium tier launch. The
  compensating controls (SAST, security tests, dependency scanning) provide
  reasonable assurance for the current free-tier scope.

---

## 11. Audit Preparation Checklist

### 11.1 Pre-Audit (90 days before)

- [ ] Identify auditor (BDO, Moss Adams, Schellman, or equivalent)
- [ ] Finalize SOC 2 scope (systems, locations, services)
- [ ] Complete all remediation items from gap analysis
- [ ] Freeze system description and control descriptions
- [ ] Populate evidence repository (`docs/evidence/`)
- [ ] Run full security test suite, export results
- [ ] Conduct internal readiness walkthrough
- [ ] Prepare system description and control narratives

### 11.2 During Audit

- [ ] Provide auditor with read-only access to repository and CI
- [ ] Schedule control walkthroughs (remote)
- [ ] Provide evidence per control mapping
- [ ] Respond to auditor inquiries within 24 hours
- [ ] Track auditor requests in a shared log
- [ ] Identify any new gaps discovered during audit

### 11.3 Post-Audit

- [ ] Receive draft report, review for accuracy
- [ ] Address any findings or exceptions
- [ ] Receive final SOC 2 Type I report
- [ ] Publish report to customer portal
- [ ] Add SOC 2 badge to README
- [ ] Begin Type II monitoring period

---

## 12. Key Personnel and Responsibilities

| Role                   | Responsibility                                  | Current Holder                                       |
| ---------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| **System Owner**       | Overall accountability for SOC 2 readiness      | Founder                                              |
| **Control Designer**   | Designs and implements control activities       | Agent / Engineer                                     |
| **Control Operator**   | Operates controls day-to-day                    | Agent / Engineer                                     |
| **Internal Auditor**   | Independent assessment of control effectiveness | Founder (pre-audit), External auditor (during audit) |
| **Evidence Collector** | Maintains evidence repository                   | Agent / Engineer                                     |
| **Audit Liaison**      | Primary point of contact for external auditor   | Founder                                              |

---

## 13. Timeline and Milestones

| Milestone                         | Target Date | Owner            |
| --------------------------------- | ----------- | ---------------- |
| Phase 7 completion (current)      | 2026-07-16  | Agent            |
| Remediate GAP-01 through GAP-07   | 2026-08-15  | Agent / Founder  |
| Populate evidence repository      | 2026-08-30  | Agent            |
| Internal readiness walkthrough    | 2026-09-15  | Agent / Founder  |
| Auditor engagement signed         | 2026-10-01  | Founder          |
| SOC 2 Type I examination          | 2026-11-01  | External auditor |
| SOC 2 Type I report issued        | 2026-12-01  | External auditor |
| Begin Type II evidence collection | 2027-01-01  | Agent / Founder  |

---

## Appendix A: Control-to-File Mapping

| Control ID | Primary File(s)                     | Test File(s)                                  |
| ---------- | ----------------------------------- | --------------------------------------------- |
| CC6-1      | `src/auth/api-key.ts`               | `test/security/auth-security.test.ts`         |
| CC6-5      | `src/auth/mfa.ts`                   | `test/unit/auth/mfa.test.ts`                  |
| CC6-6      | `src/auth/rbac.ts`                  | `test/unit/auth/rbac.test.ts`                 |
| CC5-2      | `src/util/paths.ts`                 | `test/security/path-escape.test.ts`           |
| CC5-3      | `src/util/sql.ts`                   | Sempgrep rule `no-sql-concatenation`          |
| CC5-4      | `src/search/fts5-sanitize.ts`       | `test/security/sql-injection.test.ts`         |
| CC5-1      | `src/util/process.ts`               | `test/security/shell-injection.test.ts`       |
| CC5-7      | `src/memory/secret-scan.ts`         | `test/security/secret-leak.test.ts`           |
| CC6-8      | `src/auth/session.ts`               | `test/unit/auth/session.test.ts`              |
| CC7-5      | `src/util/log.ts`                   | Manual inspection                             |
| CC7-6      | `src/governor/token-accounting.ts`  | `test/unit/governor/token-accounting.test.ts` |
| CC8-1      | `docs/CHANGE_MANAGEMENT_PROCESS.md` | Manual review                                 |
| A1-2       | `src/search/subagent.ts`            | Integration tests                             |
| PI1-1      | `src/server/index.ts`               | Integration tests                             |
| C1-1       | `src/cli/ollama.ts`                 | `test/unit/cli/ollama.test.ts`                |
| P1-1       | `PRIVACY.md`                        | Manual review                                 |

---

## Appendix B: AICPA Trust Services Criteria Reference

The full text of the AICPA Trust Services Criteria is available at:
https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2

This document maps to the **2023** TSC effective for examinations on or after
December 15, 2023.

---

## Version History

| Date       | Version | Author | Changes                                   |
| ---------- | ------- | ------ | ----------------------------------------- |
| 2026-07-16 | 1.0     | Agent  | Initial SOC 2 Type I readiness assessment |

---

_This document is versioned in the Malon repository at `docs/SOC2_READINESS.md`._
_Updates require PR review per §2.7 of AGENTS.md and approval by the founder._

_References: AICPA Trust Services Criteria (2023), AGENTS.md §2, §7, §24,_
_`docs/ACCESS_CONTROL_POLICY.md`, `docs/CHANGE_MANAGEMENT_PROCESS.md`,_
_`docs/INCIDENT_RESPONSE_PLAN.md`, `docs/VENDOR_SECURITY_QUESTIONNAIRE.md`_
