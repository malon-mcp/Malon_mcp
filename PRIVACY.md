# Privacy Policy

**Malon MCP Server**

*Version 0.0.1 — In Development*

> **This policy is a skeleton placeholder and has not been reviewed by legal counsel.**
> It must be reviewed and finalized by a qualified lawyer before the first real user.
> See AGENTS.md §24 Phase 2 checklist item 6.

## 1. What We Collect

The Software runs entirely on your local machine. It does not phone home by default.

**Data that leaves your machine (only when you use specific features):**

| Feature | Data sent | Destination | Opt-out |
|---------|-----------|-------------|---------|
| `malon_search` | 1–3 short code spans (file:line) | Your configured LLM provider (default: Anthropic) | Use local Ollama instead |
| Telemetry (if enabled) | Aggregate event counts, error classes | Malon analytics endpoint | Don't enable it |

**Data stored locally on your machine:**

| File | Contents | Git-tracked? |
|------|----------|-------------|
| `.malon/index.db` | Code index (symbols, imports, FTS) | No (gitignored) |
| `.malon/usage.log` | Query records, token counts, costs | No (gitignored) |
| `.malon/memory/*.md` | Agent-curated decisions and conventions | Yes |

## 2. LLM Provider

When you use `malon_search`, the Search Subagent sends query context to the LLM provider configured in `config.yml: search.provider` (default: Anthropic). The provider's data retention policy applies to those spans.

- Anthropic: [Commercial Terms](https://www.anthropic.com/legal/commercial-terms) — API data is not used for training.
- OpenAI: [API Data Usage](https://openai.com/policies/api-data-usage-policies)
- Ollama: Data never leaves your machine.

## 3. Telemetry

Telemetry is opt-in. When enabled, we collect:
- Aggregate counts of `malon_search`, `malon_memory_*`, and `malon_status` calls.
- Error class names (never file paths, code content, or queries).
- Latency percentiles.

We never collect file paths, source code, queries, or any personally identifiable information (PII).

## 4. Your Rights

Because the Software runs locally and no data is sent to us by default, there is no user account, no cloud storage, and no personal data for us to delete or export. Your data is your files on your machine.

If telemetry is enabled, you may:
- Opt out at any time by disabling telemetry in `config.yml`.
- Request deletion of collected telemetry data by emailing `security@yourdomain`.

## 5. Changes

This policy may be updated. We will notify you via the CHANGELOG and by updating the version date at the top of this file.

## 6. Contact

Email: `security@yourdomain`

---

*Jurisdiction: India (DPDPA 2023 compliant when finalized)*
