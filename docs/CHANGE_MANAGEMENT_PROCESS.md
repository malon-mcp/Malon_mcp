# Change Management Process — Malon

**Version:** 1.0
**Last Updated:** 2026-07-16
**Status:** Active
**Classification:** Internal — Enterprise

---

## 1. Purpose and Scope

This document defines the process for planning, reviewing, approving, implementing,
and verifying changes to the Malon MCP server, its supporting infrastructure,
CI/CD pipelines, npm publishing, and hosted services. It ensures that every change
is:

- **Reviewed** by at least one qualified human before reaching production
- **Tested** for correctness, security, and performance regressions
- **Documented** with sufficient context for future auditors and engineers
- **Reversible** — every change has a known rollback path

**Scope:** Source code, configuration, infrastructure-as-code, CI/CD workflows,
npm publishing pipeline, dependency updates, database schema changes, and
documentation that affects security posture or operational procedures.

---

## 2. Change Classification

| Class  | Label          | Definition                                                                | Examples                                                      |
| ------ | -------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **C0** | Emergency      | Security vulnerability fix, production outage, active incident mitigation | CVE patch, credential rotation, DoS fix                       |
| **C1** | Standard       | Feature addition, refactoring, dependency update, config change           | New MCP tool, tree-sitter grammar update, pricing config bump |
| **C2** | Minor          | Bug fix, test addition, documentation update, performance optimization    | Typo fix, regression test, comment update, query optimization |
| **C3** | Administrative | Non-functional changes to internal tooling, CI, scripts                   | Formatting, lint rule, CI job reordering, README formatting   |

### Classification Rules

- **A change inherits the highest classification of any file it touches.**
  A one-line config change that alters security behavior is at least C1.
- **The author classifies the change in the PR description.** The reviewer
  may reclassify before approval.
- **Emergency (C0) bypasses the standard process** but must be documented
  within 24 hours (see §6).

---

## 3. Change Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CHANGE LIFECYCLE                                  │
│                                                                          │
│  PLAN ─→ REVIEW ─→ APPROVE ─→ DEPLOY ─→ VERIFY ─→ DOCUMENT ─→ CLOSE    │
│   │        │          │          │         │          │          │       │
│   ▼        ▼          ▼          ▼         ▼          ▼          ▼       │
│  Spec    PR         Human     CI/CD     Monitor    Changelog   Done     │
│  or      opened     approval  pipeline   & test    update      │        │
│  task    against    (founder  passes    pass               │        │
│  ticket  `main`     reviews)           │                   │        │
│                   │                    │                   │        │
└───────────────────┴────────────────────┴───────────────────┴────────┘
```

### 3.1 Plan

- **C0 (Emergency):** Plan is documented in the incident tracking issue.
  Immediate remediation takes precedence over documentation.
- **C1 (Standard):** A spec or task ticket must exist before code is written.
  The spec follows `spec-driven-development` conventions from AGENTS.md.
  The spec is committed to `tasks/` or linked from the PR description.
- **C2 (Minor):** A brief description in the PR description suffices.
- **C3 (Admin):** No planning artifact required beyond the PR description.

### 3.2 Review

All changes require at least one review before merging to `main`. The review
follows the five-axis model from `code-review-and-quality`:

1. **Correctness** — Does it work? Are edge cases handled?
2. **Readability** — Can another engineer understand it without the author?
3. **Architecture** — Does it fit the system? Does it reduce complexity?
4. **Security** — Does it pass the security review gates?
5. **Performance** — Does it pass the performance budgets?

**Review requirements by change class:**

| Class | Required Reviewers | Review SLA |
| ----- | ------------------ | ---------- |
| C0    | Founder (async ok) | < 4 hours  |
| C1    | Founder            | < 24 hours |
| C2    | Any human engineer | < 48 hours |
| C3    | Optional           | < 72 hours |

### 3.3 Approve

Approval means:

1. The PR description follows the §22.4 format from AGENTS.md (What / Why / Risk
   / How to Verify / Out of Scope).
2. All CI checks pass (or known-failed checks are acknowledged in the PR description).
3. Security tests pass (release gate — not optional).
4. The "How to verify" section is concrete and executable by the founder.
5. The diff is readable by a non-technical reviewer — the PR description is the
   artifact, not the code.

### 3.4 Deploy

| Deployment Type    | Method                                                      |
| ------------------ | ----------------------------------------------------------- |
| npm release        | Tag-triggered CI via Trusted Publishing (OIDC) + provenance |
| Config change      | Next server start picks up `.malon/config.yml` changes      |
| Git hook update    | Re-run `malon init` to reinstall hooks                      |
| CI workflow change | Merged to `main` — takes effect immediately on next run     |

**No deployment happens without:** (a) a green CI suite, (b) a written rollback plan,
(c) human approval for the merge.

### 3.5 Verify

Within 1 hour of deployment (or within the monitoring window for staged rollouts):

| Check                      | C0  | C1  | C2  | C3  |
| -------------------------- | --- | --- | --- | --- |
| Health check passes        | ✓   | ✓   | ✓   | —   |
| Error rate within baseline | ✓   | ✓   | —   | —   |
| Latency within baseline    | ✓   | ✓   | —   | —   |
| Critical flow smoke test   | ✓   | ✓   | ✓   | —   |
| Security tests pass        | ✓   | ✓   | ✓   | ✓   |

### 3.6 Document

- **CHANGELOG.md:** Updated for any user-visible change (C0, C1, C2).
- **README.md:** Updated if the change affects user-facing behavior or setup.
- **ADRs:** Written for architectural decisions (C1 that changes the architecture).
- **This document:** Updated if the change management process itself changes.

### 3.7 Close

The change is closed when:

- All verification checks pass
- Documentation is updated
- The founder has confirmed the change is working as expected (or acknowledged
  for C2/C3)

---

## 4. Change Review Board (CRB)

### 4.1 Composition

| Role             | Responsibility                       | Holder           |
| ---------------- | ------------------------------------ | ---------------- |
| Chair            | Final approval authority, scheduling | Founder          |
| Security Lead    | Security impact assessment           | Agent / Engineer |
| Engineering Lead | Technical feasibility, architecture  | Agent / Engineer |
| Ops Lead         | Deployment, rollback, monitoring     | Agent / Engineer |

### 4.2 When the CRB Must Convene

- C0 changes affecting infrastructure or publish pipeline
- C1 changes that:
  - Add a new MCP tool
  - Change the output schema of an existing tool
  - Add a new external dependency
  - Modify the security model or trust claim
  - Change the pricing posture
  - Touch the publish pipeline
  - Alter data retention or handling
- Any change that the PR author or reviewer flags as requiring CRB review

### 4.3 CRB Meeting Format

```
1. Change overview (5 min) — Author presents the PR description
2. Security impact (5 min) — Security Lead reviews threat model changes
3. Technical review (10 min) — Architecture, dependencies, test coverage
4. Ops impact (5 min) — Deployment, monitoring, rollback plan
5. Decision (5 min) — Approve, approve with conditions, or reject
```

For asynchronous review, the CRB communicates via PR comments with a 24-hour
voting window. Silence = abstain.

---

## 5. Emergency Change Process (C0)

### 5.1 Triggers

- Active security vulnerability exploitation
- Production service unavailability
- Data loss or corruption in progress
- Compromised credential requiring immediate rotation
- Published package with known CVE

### 5.2 Process

```
Incident detected
    │
    ▼
Assess severity (P0/P1 per IR plan)
    │
    ▼
Author creates fix on `security/` or `hotfix/` branch
    │
    ▼
Notify founder immediately (out-of-band: phone/Signal)
    │
    ▼
Founder reviews diff (can be async, < 4 hours)
    │
    ▼
Merge and deploy
    │
    ▼
Within 24 hours:
  - Retrospective PR description written
  - Normal CI run completed (if emergency bypassed CI)
  - Regression test added
  - Incident report updated
```

### 5.3 Safeguards

- Emergency changes still require **at least one human review** (even if async).
- Emergency changes **never bypass** the security test suite. If tests take
  too long, the emergency fix is validated manually first, then the test suite
  runs asynchronously.
- Emergency changes to the publish pipeline require the founder's explicit
  go-ahead. There is no auto-remediation for the pipeline itself.
- After the emergency resolves, a postmortem is written within 2 weeks per
  Appendix B of AGENTS.md.

---

## 6. Dependency Change Management

Dependency changes (adding, upgrading, or removing npm packages) follow a
separate, stricter path:

### 6.1 Adding a New Dependency

Per AGENTS.md §2.6:

1. **Confirm existence** — Check `https://www.npmjs.com/package/<pkg>`.
   Verify maintainer, repository link, publish date predates this PR.
2. **Read repository field** — If the repo doesn't exist, doesn't match npm
   metadata, or was registered in the last 30 days, treat as suspicious.
3. **Pin exact version** — No `^` or `~`.
4. **Commit lockfile** — CI uses `npm ci`, never `npm install`.
5. **Justify in PR** — Add rationale for why this dep over stdlib or existing deps.
6. **Review scripts** — If the dep has install scripts, justify each and add
   to allow-list in `scripts/allow-install-scripts.sh`.

### 6.2 Upgrading a Dependency

Per AGENTS.md code-review skill:

1. **Read the changelog** — Semver is a promise the maintainer may not have kept.
2. **One dependency per change** — Upgrade individually or in small related groups.
3. **Let the tests decide** — Green suite before and after.
4. **Review lockfile diff** — Not just `package.json`; transitive changes matter.

---

## 7. Rollback Procedure

### 7.1 Rollback Plan Template

Every C0 and C1 deployment includes a rollback plan in the PR description:

```markdown
### Rollback Plan

Trigger conditions:

- Error rate > 2x baseline for 5 minutes
- P95 latency > 2s for 5 minutes
- User-reported issue matching this change

Steps:

1. Feature flag disable (if applicable): <command>
   OR version revert: `git revert <sha> && git push`
2. Verify health endpoint returns 200
3. Verify error rate returns to baseline

Database considerations:

- Migration <name> has rollback: <command>
- Data from new feature: <preserved / cleaned up>

Time to rollback:

- Feature flag: < 1 minute
- Version revert: < 5 minutes
- Database rollback: < 15 minutes
```

### 7.2 Rollback Authorization

| Class | Who Can Authorize  | Notification Required |
| ----- | ------------------ | --------------------- |
| C0    | Incident Commander | Founder within 1 hour |
| C1    | Founder            | —                     |
| C2    | Any engineer       | PR comment            |
| C3    | Any engineer       | —                     |

---

## 8. Change Freeze Windows

| Window                      | Scope                               | Rationale                   |
| --------------------------- | ----------------------------------- | --------------------------- |
| 48 hours before npm release | No C1 changes to publish pipeline   | Ensure release stability    |
| Major holiday weekends      | No C0/C1 unless security-critical   | Reduced coverage            |
| During active incident      | Only C0 changes related to incident | Avoid compounding incidents |

---

## 9. Metrics and Auditing

| Metric                        | Target              | Measured By                   |
| ----------------------------- | ------------------- | ----------------------------- |
| PRs merged without review     | 0% (zero tolerance) | GitHub branch protection logs |
| Emergency changes (C0)        | < 5% of total       | PR labels / incident tracking |
| Time from PR open to merge    | < 48 hours (C1)     | GitHub metrics                |
| Rollback rate                 | < 2% of deployments | Deployment tracking           |
| Changes with written rollback | 100% (C0, C1)       | PR description template check |
| Changes with regression test  | 100% (bug fixes)    | Test suite coverage           |

---

## 10. Version History

| Date       | Version | Author | Changes                           |
| ---------- | ------- | ------ | --------------------------------- |
| 2026-07-16 | 1.0     | Agent  | Initial change management process |

---

_This document is versioned in the Malon repository at `docs/CHANGE_MANAGEMENT_PROCESS.md`._
_Updates require PR review per §2.7 of AGENTS.md and approval by the founder._

_References: AGENTS.md §2.6 (dependency checks), §2.7 (human-reviewed PRs), §18 (CI/CD),
§19.4 (release process), §22.4 (PR description format), `code-review-and-quality` skill_
