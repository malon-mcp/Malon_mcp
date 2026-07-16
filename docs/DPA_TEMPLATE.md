# Data Processing Agreement (Template)

**Version:** 1.0
**Last Updated:** 2026-07-16

---

## Instructions

1. Replace all `[bracketed text]` with the relevant details.
2. Have this reviewed by legal counsel before signing with any customer.
3. This template covers GDPR (EU), DPDPA 2023 (India), and CCPA (California) requirements.
4. For enterprise customers requiring SOC 2, additional exhibits may be needed.

---

## DATA PROCESSING AGREEMENT

**Between:**

**[Customer Legal Name]** ("Controller")
[Customer Address]

**and**

**[Malon Legal Entity Name]** ("Processor")
[Processor Address]

**Effective Date:** [Date]

---

### 1. Definitions

1.1 **"Personal Data"** means any information relating to an identified or identifiable natural person as defined under Applicable Data Protection Law.

1.2 **"Processing"** means any operation performed on Personal Data, including collection, storage, retrieval, consultation, use, transmission, or deletion.

1.3 **"Applicable Data Protection Law"** means:

- Regulation (EU) 2016/679 (General Data Protection Regulation — "GDPR")
- India's Digital Personal Data Protection Act, 2023 ("DPDPA 2023")
- California Consumer Privacy Act of 2018 as amended ("CCPA")
- Any other data protection or privacy laws applicable to the Processing

1.4 **"Data Subject"** means an identified or identifiable natural person.

1.5 **"Sub-processor"** means any third party engaged by the Processor to Process Personal Data on behalf of the Controller.

---

### 2. Scope and Purpose

2.1 The Controller appoints the Processor to Process Personal Data in connection with the provision of the Malon MCP server and related services (the "Services") as described in the Master Services Agreement between the parties.

2.2 The nature and purpose of the Processing is:

- **Purpose:** Providing the Malon MCP server, search indexing, memory ledger, and cost governance services
- **Nature:** Automated processing of codebase metadata, search queries, and usage metrics
- **Duration:** The term of the agreement between Controller and Processor plus 30 days for data deletion

2.3 The categories of Data Subjects may include:

- Developers and engineers employed by or contracting with the Controller
- System administrators and DevOps personnel
- Any other individuals whose data is included in codebase queries or usage logs

2.4 The types of Personal Data processed may include:

- User identifiers (email addresses, usernames, API key identifiers)
- Session metadata (timestamps, IP addresses, agent identifiers)
- Usage metrics and query patterns (hashed queries, token counts, file paths)
- **The Processor does not process the contents of code files as Personal Data.** Code spans sent to the Search Subagent's LLM provider are treated as business data, not Personal Data, per the Controller's instructions.

---

### 3. Processor Obligations

3.1 The Processor shall:
a) Process Personal Data only on documented instructions from the Controller, unless required to do so by applicable law (in which case the Processor shall inform the Controller of that legal requirement before Processing, unless that law prohibits such information on important grounds of public interest)
b) Ensure that persons authorized to process the Personal Data have committed themselves to confidentiality or are under an appropriate statutory obligation of confidentiality
c) Implement appropriate technical and organizational measures to ensure a level of security appropriate to the risk (see Appendix 1)
d) Respect the conditions for engaging Sub-processors as set out in Section 5
e) Assist the Controller by appropriate technical and organizational measures, insofar as possible, for the fulfillment of the Controller's obligation to respond to requests for exercising the Data Subject's rights
f) Assist the Controller in ensuring compliance with obligations pursuant to Articles 32 to 36 of the GDPR (security, breach notification, data protection impact assessment, prior consultation), taking into account the nature of Processing and the information available to the Processor
g) At the choice of the Controller, delete or return all the Personal Data to the Controller after the end of the provision of Services, and delete existing copies unless applicable law requires storage
h) Make available to the Controller all information necessary to demonstrate compliance with this Agreement

---

### 4. Controller Obligations

4.1 The Controller shall:
a) Ensure that the Processing of Personal Data, as instructed to the Processor, complies with Applicable Data Protection Law
b) Establish a lawful basis for the Processing (consent, contract, legitimate interest, or other basis as required)
c) Provide clear, documented instructions to the Processor regarding the Processing of Personal Data
d) Notify the Processor within 48 hours of receiving a Data Subject request related to Personal Data processed by the Processor
e) Conduct any required Data Protection Impact Assessment prior to commencing Processing

---

### 5. Sub-processors

5.1 The Controller grants general authorization for the Processor to engage Sub-processors for the provision of the Services, subject to the following conditions:
a) The Processor maintains an up-to-date list of Sub-processors at [URL or attach as Appendix 2]
b) The Processor shall notify the Controller at least 14 days before adding or replacing any Sub-processor
c) The Controller may object to a Sub-processor within 7 days of notification on reasonable grounds relating to data protection
d) The Processor shall impose, by written agreement, the same data protection obligations on each Sub-processor as are imposed by this Agreement

5.2 Current Sub-processors (as of Effective Date):

- **[LLM Provider, e.g., Anthropic]** — API provider for Search Subagent queries; data retention policy at [URL]
- **[Hosting Provider, if applicable]** — Cloud infrastructure provider; data processed at rest in [region]

---

### 6. Data Subject Rights

6.1 The Processor shall assist the Controller in responding to Data Subject requests under Applicable Data Protection Law, including:
a) Right of access
b) Right to rectification
c) Right to erasure ("right to be forgotten")
d) Right to restriction of Processing
e) Right to data portability
f) Right to object

6.2 Upon receiving a request directly from a Data Subject, the Processor shall:
a) Acknowledge receipt within 48 hours
b) Forward the request to the Controller within 72 hours
c) Not respond to the request without prior authorization from the Controller

---

### 7. Security Measures

7.1 The Processor shall implement and maintain the technical and organizational security measures described in **Appendix 1**.

7.2 The Processor may update these measures provided that the overall level of security is not reduced.

---

### 8. Data Breach Notification

8.1 The Processor shall notify the Controller without undue delay (and in any event within 24 hours of becoming aware) of any Personal Data breach.

8.2 The notification shall include:
a) A description of the nature of the breach including, where possible, the categories and approximate number of Data Subjects and Personal Data records concerned
b) The name and contact details of the Processor's data protection officer or other point of contact
c) A description of the likely consequences of the Personal Data breach
d) A description of the measures taken or proposed to be taken to address the Personal Data breach

8.3 The Processor shall cooperate with the Controller regarding any required notifications to supervisory authorities or Data Subjects under Applicable Data Protection Law.

8.4 **CERT-In Notification:** For breaches affecting Indian Data Subjects, the Processor shall assist the Controller in meeting the 6-hour reporting obligation under CERT-In guidelines, measured from the time of notice of the breach.

---

### 9. Data Retention and Deletion

9.1 The Processor shall retain Personal Data only for the duration necessary to provide the Services, subject to the Controller's documented retention policies.

9.2 Upon termination of the Services or upon the Controller's written request:
a) Usage logs: deleted or anonymized within 30 days
b) Session data: deleted or anonymized within 7 days
c) Authentication data (API keys, MFA secrets): deleted within 30 days
d) Any other Personal Data: deleted within 60 days

9.3 The Processor shall provide written confirmation of deletion upon request.

9.4 This section survives termination of the Agreement.

---

### 10. Data Transfers

10.1 Personal Data may be transferred to [list countries/regions] for Processing.

10.2 Cross-border transfers shall be governed by:

- Standard Contractual Clauses (SCCs) as adopted by the European Commission, where GDPR applies
- Equivalent transfer mechanisms under DPDPA 2023, where Indian law applies
- Any other transfer mechanism required by Applicable Data Protection Law

---

### 11. Audit Rights

11.1 The Controller may audit the Processor's compliance with this Agreement once per calendar year, subject to:
a) 30 days' written notice
b) The audit being conducted during business hours
c) The audit not unreasonably interfering with the Processor's operations
d) The Controller bearing the costs of the audit

11.2 Alternatively, the Controller may accept a SOC 2 Type 2 report or equivalent certification in lieu of an on-site audit.

---

### 12. Limitation of Liability

12.1 Each party's liability under this DPA shall be subject to the limitations set out in the Master Services Agreement.

12.2 Nothing in this DGA limits or excludes liability for:
a) Death or personal injury caused by negligence
b) Fraud or fraudulent misrepresentation
c) Breach of applicable data protection law

---

### 13. Governing Law

13.1 This DPA shall be governed by the laws of [Jurisdiction].

13.2 Any dispute arising from this DPA shall be subject to the exclusive jurisdiction of the courts of [Jurisdiction].

---

### 14. Signatures

**For the Controller:**

Name: ______________________________
Title: ______________________________
Date: ______________________________
Signature: ______________________________

**For the Processor ([Legal Entity Name]):**

Name: ______________________________
Title: ______________________________
Date: ______________________________
Signature: ______________________________

---

## Appendix 1 — Technical and Organizational Security Measures

### Access Control

- All API keys are hashed with SHA-256 before storage; plaintext keys are never persisted
- Session tokens are cryptographically random (48 bytes, base64url-encoded)
- MFA secrets are hashed at rest
- Role-based access control (RBAC) with role hierarchy: admin > operator > service > user > viewer

### Data Encryption

- Data in transit: TLS 1.2+ for all API communications (HTTPS)
- Data at rest: SQLite WAL mode with file-system-level encryption available
- No static encryption of local index.db (regenerable from source)

### Infrastructure Security

- npm publishing uses Trusted Publishing (OIDC) with provenance attestation
- Dependencies audited via `npm audit` and license-checker on every PR
- Install scripts disabled by default; allow-list maintained per package
- Lockfile committed and CI uses `npm ci`

### Application Security

- All SQL queries are parameterized; no string concatenation into queries
- All filesystem paths are canonicalized and boundary-checked (path-escape tests)
- All subprocesses use `execFile` with argument arrays (no shell)
- Input validated at all system boundaries using Zod schemas

### Monitoring and Detection

- Gitleaks pre-commit hook scans for secrets
- TruffleHog in CI on every PR verifies credentials
- Semgrep SAST in CI catches injection and security anti-patterns
- Usage log with SHA-256 hashed queries for audit (full queries in local-only log)

### Incident Response

- 24-hour acknowledgment SLA for security reports
- 72-hour triage SLA
- Coordinated disclosure with 90-day default window
- Incident response plan documented in `docs/INCIDENT_RESPONSE_PLAN.md`

---

## Appendix 2 — Sub-processor List

| Sub-processor         | Service              | Data Categories                     | Location | Retention Policy |
| --------------------- | -------------------- | ----------------------------------- | -------- | ---------------- |
| [LLM Provider]        | Search Subagent API  | Code spans (1-3 file:line snippets) | [Region] | [Link to policy] |
| [Hosting Provider]    | Cloud infrastructure | All hosted data                     | [Region] | [Link to policy] |
| [Monitoring Provider] | Error reporting      | Error logs (anonymized)             | [Region] | [Link to policy] |

---

_This is a template document. It must be reviewed by qualified legal counsel before use. The template covers common requirements but may not address all obligations under your specific regulatory framework or contractual context._
