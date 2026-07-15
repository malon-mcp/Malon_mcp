# rejected.md — Approaches tried and discarded

Each entry is an H2 heading followed by 2-3 sentences explaining what was tried, why it didn't work, and what was chosen instead.
Format:

```
## <Rejected approach>
<What was tried, why it didn't work (specific evidence or reasoning), and what replaced it. 2-3 sentences.>
```

Example:

```
## JSON-based index (rejected for SQLite)
A JSON file was prototyped for the code index. It worked at toy scale but became
unusable past ~500 files due to full-file rewrites and lack of query capability.
Replaced with SQLite FTS5 which gives ranked search and incremental updates.
```
