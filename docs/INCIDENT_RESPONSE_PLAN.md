# Incident Response Plan — Malon

**Version:** 1.0
**Last Updated:** 2026-07-16
**Status:** Active

---

## 1. Purpose

This document defines the procedure for detecting, responding to, and recovering from security incidents affecting the Malon MCP server and its hosted services. It ensures:

- Rapid containment and mitigation of active threats
- Compliance with legal and regulatory obligations (CERT-In 6-hour clock, GDPR 72-hour, DPDPA 2023)
- Consistent communication with affected users and stakeholders
- Post-incident learning to prevent recurrence

---

## 2. Incident Severity Classification

| Severity | Label    | Definition                                                                                       | Response SLA         | Example                                                                |
| -------- | -------- | ------------------------------------------------------------------------------------------------ | -------------------- | ---------------------------------------------------------------------- |
| **P0**   | Critical | Active data exfiltration, unauthenticated access to user codebases, compromised publish pipeline | < 1 hour containment | npm package with backdoor, path traversal allowing arbitrary file read |
| **P1**   | High     | Credential exposure, authentication bypass, significant DoS vulnerability                        | < 4 hours            | API key leaked in commit, session token predictable                    |
| **P2**   | Medium   | Information disclosure (non-critical), rate-limit bypass, minor access-control gap               | < 24 hours           | Usage log hash collision, debug endpoint exposed                       |
| **P3**   | Low      | Best-practice gap, hardening opportunity, dependency advisory without exploit                    | < 7 days             | Outdated TLS config, missing security headers                          |

---

## 3. Incident Response Team

| Role                   | Responsibility                                                                    | Primary Contact  | Secondary Contact                     |
| ---------------------- | --------------------------------------------------------------------------------- | ---------------- | ------------------------------------- |
| **Incident Commander** | Coordinates response, makes containment decisions, handles external communication | Founder          | —                                     |
| **Security Lead**      | Technical investigation, root cause analysis, fix implementation                  | Agent / Engineer | —                                     |
| **Legal / Compliance** | Regulatory filings (CERT-In, GDPR), customer notification, counsel contact        | Founder          | Outside counsel: _[insert name/firm]_ |
| **Communications**     | Customer-facing updates, status page, post-incident messaging                     | Founder          | —                                     |
| **Engineering**        | Code fix, deployment, regression test, rollback execution                         | Agent / Engineer | —                                     |

**24/7 Contact:** `security@yourdomain` (monitored within 24h, pager escalation available on request)

---

## 4. Incident Response Procedure

### 4.1 Detection

Incidents may be detected through:

- Automated security scanning (Gitleaks pre-commit, TruffleHog CI, `npm audit`)
- Monitoring alerts (error rate spikes, latency anomalies)
- External report via `security.txt` / `security@yourdomain`
- User report (abnormal behavior, unexpected data access)
- Dependency advisory notification (Dependabot, GitHub Advisory)

### 4.2 Triage (First 60 Minutes)

1. **Acknowledge** the finding — create a private tracking issue with `security/` prefix
2. **Classify** severity using the table in §2
3. **Contain** — for P0/P1: immediately stop the bleeding (revert deployment, revoke credentials, disable affected feature)
4. **Document** the initial finding, affected versions, and any evidence in the tracking issue

**CERT-In 6-hour clock:** If the incident involves a data breach affecting Indian users, the 6-hour reporting window starts now (at time of notice, not triage). Contact legal counsel immediately.

### 4.3 Investigation (First 24 Hours)

1. **Reproduce** the vulnerability in a controlled environment
2. **Scope** the impact:
   - Which versions are affected?
   - Which users/configs are affected?
   - What data was accessed or exposed?
   - Is there evidence of active exploitation?
3. **Root cause analysis** — identify the underlying flaw, not just the symptom
4. **Pre-draft customer notification** (see §7 for template)

### 4.4 Remediation (First 72 Hours)

1. **Develop fix** in a private `security/<slug>` branch
2. **Write regression test** that catches this specific vulnerability class
3. **Review fix** — code review, adversary review from fresh perspective
4. **Ship fix** — merge to `main`, publish patch release
5. **Verify** — confirm vulnerability no longer exploitable, all security tests pass
6. **Notify affected users** — send pre-drafted notification; for P0/P1, notify within 24h of fix

### 4.5 Post-Incident (First 2 Weeks)

1. **Write postmortem** — see `docs/postmortems/_template.md`; include:
   - Timeline of events
   - Root cause
   - What worked / what didn't in the response
   - Recommended process changes
2. **Update controls** — modify security tests, threat model, detection rules
3. **Update this plan** — lessons learned incorporated
4. **Close out** — mark tracking issue resolved, archive evidence

---

## 5. Communication Templates

### 5.1 Initial Acknowledgment (to reporter)

```
Subject: Security report acknowledgment — [brief description]

We've received your report and are investigating. We'll provide an
update within 72 hours. Thank you for responsibly disclosing this.

Reference: MALON-SEC-YYYY-NNN
```

### 5.2 Customer Notification (for verified incidents)

```
Subject: Security notice — Malon [version] — action recommended

We're writing to let you know about a security issue affecting
Malon versions [range]. [One-paragraph description of the issue,
the conditions under which it could be exploited, and what data
or operations were at risk.]

We have released version [fixed_version] that resolves this issue.
We recommend upgrading as soon as possible: `npm update malon`.

No customer data was exposed in this incident. [OR: If data was
exposed, describe the scope and the steps being taken.]

If you have questions, contact security@yourdomain. We'll provide
further updates as our investigation continues.

Reference: MALON-SEC-YYYY-NNN
```

### 5.3 Regulatory Notification (CERT-In / GDPR)

```
To: [regulatory body]
Subject: Incident notification — MALON-SEC-YYYY-NNN

This is a notification under [applicable regulation].

Organization: [legal entity name]
Contact: security@yourdomain
Time of notice: [ISO 8601 timestamp]
Affected users: [count or estimate]
Nature of incident: [description]
Data potentially affected: [categories of data]
Status of investigation: [ongoing / complete]
Mitigation steps taken: [summary]
```

---

## 6. Contacts

| Contact                 | Details                                                      |
| ----------------------- | ------------------------------------------------------------ |
| Security email          | `security@yourdomain`                                        |
| npm security            | https://docs.npmjs.com/policies/security                     |
| GitHub security         | https://github.com/contact/security                          |
| CERT-In                 | _[insert current reporting URL — check at time of incident]_ |
| Cyber liability insurer | _[insurer name, policy #, 24h claim line]_                   |
| Outside counsel         | _[name, firm, email, phone]_                                 |
| Legal (DPDPA/GDPR)      | _[name or firm]_                                             |

---

## 7. Incident Types and Playbooks

### 7.1 npm Supply Chain Compromise

Scenario: malicious code in published npm package `malon`.

**Immediate actions:**

1. Run `npm unpublish <version>` (allowed within 72 hours of publish)
2. Deprecate affected version on npm: `npm deprecate malon@<version> "security vulnerability"`
3. Rotate npm token, review publish logs
4. Audit lockfile for unexpected transitive changes
5. Review CI/CD pipeline for compromise

**Fix:**

- Revert to last known-good commit
- Ship hotfix from clean base
- Add supply-chain controls (provenance attestation, Trusted Publishing confirmed on)

### 7.2 Path Traversal / File Read Outside Repo

Scenario: an attacker crafts a `malon_search` call that reads `/etc/passwd` or `.env`.

**Immediate actions:**

1. Confirm the path-escape test (`test/security/path-escape.test.ts`) catches the variant
2. Identify when the vulnerable code was introduced
3. Check audit logs for evidence of exploitation

**Fix:**

- Tighten `resolveInside()` in `src/util/paths.ts`
- Add regression test covering the specific escape technique
- Review all filesystem operations for path boundary enforcement

### 7.3 API Key / Session Token Leak

Scenario: a secret is committed to git or logged in plaintext.

**Immediate actions:**

1. Rotate the compromised credential immediately
2. Scan git history with Gitleaks/TruffleHog at HEAD and recent commits
3. If found in history, rotate any other credentials that were active during the exposed period

**Fix:**

- Add secret pattern to detection rules
- If caused by logging, audit log statements for sensitive data

### 7.4 Denial of Service (Subagent or API)

Scenario: crafted query causes the Search Subagent to hang or exhaust resources.

**Immediate actions:**

1. Verify subagent timeout and caps are in effect (§2.4)
2. Rate-limit the offending session or API key
3. Check for broader pattern (coordinated attack vs. single user)

**Fix:**

- Tighten subagent timeouts
- Add input validation for pathological query patterns
- Consider per-API-key rate limits

---

## 8. Incident Tracking

Every incident gets a tracking entry:

```
MALON-SEC-YYYY-NNN
──────────────────
Severity:    P0/P1/P2/P3
Status:      triage / investigation / remediation / resolved
Date opened: YYYY-MM-DD HH:MM UTC
Date closed: YYYY-MM-DD HH:MM UTC
Reported by: [external / internal / automated]
Affected:    [versions, configs]
Root cause:  [one-line summary]
Fix:         [PR/commit reference]
Regression:  [test file reference]
```

---

## 9. Testing This Plan

- Tabletop exercise every quarter (walk through a scenario end-to-end)
- After any significant architecture change affecting the security boundary
- After any change to the publish pipeline
- After hiring or changing the incident response team composition

---

## 10. Version History

| Date       | Version | Author | Changes                        |
| ---------- | ------- | ------ | ------------------------------ |
| 2026-07-16 | 1.0     | Agent  | Initial incident response plan |

---

_This plan is versioned in the Malon repository at `docs/INCIDENT_RESPONSE_PLAN.md`. Updates require PR review per §2.7 of AGENTS.md._
