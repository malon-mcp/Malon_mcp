# Security

Malon reads your codebase to index it. This page tells you exactly what
happens to that data.

## Zero-trust deployment: local-only mode (recommended for sensitive code)

Malon can run entirely offline using Ollama with local open-weight models.
**In this mode, no data — not a single token — ever leaves your machine.**

```bash
# Quick start:
malon local-check          # Verify Ollama is running
malon init --local         # Auto-configure for local-only mode
```

```yaml
# Equivalent manual config.yml:
search:
  provider: ollama
  model: llama3.1-8b
```

Check the local status at any time:

```bash
malon status              # Shows "local_mode: true" when active
```

**Recommended models:** `llama3.1-8b` (default, 8GB RAM), `phi3:14b` (quality/size sweet spot),
`mistral-7b` (fast), `qwen2.5-coder:7b` (code-focused). Run `malon local-check` for a full list.

**Enterprise trust guarantee:** When Ollama is configured as the search provider, Malon
makes no outbound network calls except for telemetry (which is opt-in and disabled by default).
Your code, queries, and index stay on your machine.

## Cloud mode (default)

By default, the **Search Subagent** sends short code spans to your
configured LLM provider when answering a `malon_search` query. The spans
are the 1-3 file:line snippets returned to your coding agent, not whole
files.

By default, no other data leaves your machine. Telemetry is opt-in
(`MALON_TELEMETRY=1` or `config.yml: telemetry.enabled: true`).

## Default LLM provider and retention

- Provider: set at `config.yml: search.provider` (default: `gemini`)
- Model: set at `config.yml: search.model` (default: `gemini-2.0-flash`)
- Data retention: [Gemini API Data Governance](https://cloud.google.com/terms/service-terms#11-data-protection) — API data is not used for training and is subject to Google's data processing terms.

## What we never do

- We never read, store, or transmit the full text of files. Only the
  indexed spans (file:line) and only when answering a `malon_search`
  call you made.
- We never read your `.env`, `*.key`, `*.pem`, or any file matched by
  `index.ignore_patterns` in `config.yml`.
- We never run a shell command with a string you (or the model) gave us.
- We never run a process outside the configured allow-list
  (`git`, `node` for tests).

## Reporting a vulnerability

See `.well-known/security.txt` for our security contact and disclosure
policy. We acknowledge within 24 hours and triage within 72 hours.
We follow coordinated disclosure with a 90-day default window.
