# Security

Malon reads your codebase to index it. This page tells you exactly what
happens to that data.

## What leaves your machine

By default, the **Search Subagent** sends short code spans to your
configured LLM provider when answering a `malon_search` query. The spans
are the 1-3 file:line snippets returned to your coding agent, not whole
files.

By default, no other data leaves your machine. Telemetry is opt-in
(`MALON_TELEMETRY=1` or `config.yml: telemetry.enabled: true`).

## Default LLM provider and retention

- Provider: set at `config.yml: search.provider` (default: `anthropic`)
- Model: set at `config.yml: search.model` (default: `claude-haiku-4-5`)
- Data retention: [Anthropic API Terms](https://www.anthropic.com/legal/commercial-terms) — API data is not used for training or retained beyond 30 days unless otherwise agreed.

## Local-only option

You can switch the Search Subagent to a local open-weight model via
Ollama. With that setting, no code leaves your machine at any point.

```yaml
# config.yml
search:
  provider: ollama
  model: llama3.1-8b
```

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
policy. Email `security@yourdomain`. We acknowledge within 24 hours and
triage within 72 hours. We follow coordinated disclosure with a 90-day
default window.
