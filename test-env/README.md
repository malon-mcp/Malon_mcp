# Malon Test Environment

## How a Normal Dev Uses This

```powershell
# From your project folder (the repo root):
.\test-env\run.ps1
```

That's it. One command. It:

1. **Builds** Malon (TypeScript compile check)
2. **Tests CLI** — init, status, index, incremental, reset, help
3. **Tests MCP tools** — malon_search, malon_memory_get, malon_memory_write
4. **Compares WITH vs WITHOUT Malon** — runs searches with malon_search AND with native grep, shows tokens saved
5. **Hunts bugs** — empty repos, unicode paths, malformed files, double init, stale lock recovery
6. **Full lifecycle** — init -> index -> status -> reset

## The Comparison (With vs Without Malon)

The script runs the same search queries two ways:

| Without Malon                           | With Malon                             |
| --------------------------------------- | -------------------------------------- |
| Native grep reads ALL matching files    | malon_search returns 1-3 precise spans |
| Est. 4000 tokens per file read          | Actual input+output tokens             |
| Must read full files to find the answer | Only reads the relevant spans          |

The report shows tokens saved and percentage improvement.

## Files

- `run.ps1` — **main entry point**, run this
- `run-malon-tests.ps1` — comprehensive QA suite (15 phases, deeper checks)
- `diagnostics.ps1` — targeted bug finder (edge cases, security, config parser)
- `run-malon-tests.sh` — bash version for Linux/macOS
- `fixtures/` — sample repos for testing

## Requirements

- Node.js >= 20
- `npm run build` (or the script will run it)
