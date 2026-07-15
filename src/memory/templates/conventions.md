# conventions.md — Code style and pattern conventions

Each entry is an H2 heading followed by 2-3 sentences describing a convention.
Format:

```
## <Convention title>
<What the convention is, why it exists, and how to apply it. 2-3 sentences.>
```

Example:

```
## Import structure: built-ins → external → internal → relative
Group imports with a blank line between groups. This makes dependency direction
visible at a glance and avoids accidental circular imports through barrel files.
```
