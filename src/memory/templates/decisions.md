# decisions.md — Architectural decisions

Each entry is an H2 heading followed by 2-3 sentences explaining the decision and its rationale.
Format:
```
## <Short decision title>
<Why this choice was made, what alternatives were considered, and the key trade-off. 2-3 sentences.>
```

Example:
```
## Use tree-sitter for parsing, not a hand-rolled lexer
tree-sitter gives us incremental, multi-language parsing with mature grammar
support, and lets us share one index across languages. The alternative —
hand-rolling a per-language lexer — was rejected because of the maintenance
burden and the fact that it would foreclose the JS/TS support that's most of
our early user base.
```
