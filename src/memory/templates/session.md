# sessions/ — Per-session checkpoint summaries

Each file is a single session checkpoint, named `<date>-<short-slug>.md`.
Content is a structured summary of what was accomplished and what decisions were made.
Format:
```
## Session: <short description>
- **Tasks completed**: <one-line summary>
- **Key decisions**: <one-line per decision>
- **Open questions**: <anything unresolved>
- **Context**: <context tokens used, rot signal if any>
```

Example:
```
## Session: JWT auth refactor
- **Tasks completed**: Replaced hand-rolled JWT validation with middleware library
- **Key decisions**: Using jsonwebtoken library for token parsing, centralised secret rotation in config
- **Open questions**: Token refresh flow not yet tested with concurrent requests
- **Context**: 45K tokens used, no rot signal
```
