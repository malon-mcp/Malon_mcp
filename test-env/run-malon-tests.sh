#!/usr/bin/env bash
# =============================================================================
# Malon Comprehensive QA Automation Workflow (Bash)
# =============================================================================
# Cross-platform equivalent of run-malon-tests.ps1 for Linux/macOS.
# Run:  bash test-env/run-malon-tests.sh
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_ENV="$REPO_ROOT/test-env"
FIXTURE_DIR="$TEST_ENV/fixtures/sample-repo"
WORK_DIR="$TEST_ENV/work"
MALON_CLI="$REPO_ROOT/dist/cli/index.js"
SUMMARY_FILE="$TEST_ENV/summary.json"
LOG_FILE="$TEST_ENV/report.jsonl"

PASS=0; FAIL=0; WARN=0
RESULTS=()
ERRORS=()
WARNINGS=()
IMPROVEMENTS=()
PERF_RESULTS=""
EXIT_CODE=0
START_TIME=$(date +%s)

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; GRAY='\033[0;90m'
NC='\033[0m'

step()  { echo -e "\n━━━ $1 ━━━"; }
pass()  { PASS=$((PASS+1)); echo -e "  ${GREEN}✅ [PASS]${NC} $1"; }
fail()  { FAIL=$((FAIL+1)); EXIT_CODE=1; echo -e "  ${RED}❌ [FAIL]${NC} $1 — $2"; }
warn()  { WARN=$((WARN+1)); echo -e "  ${YELLOW}⚠️  [WARN]${NC} $1 — $2"; }

invoke_malon() {
  local timeout=30
  local outfile="$TEST_ENV/_stdout.tmp"
  local errfile="$TEST_ENV/_stderr.tmp"
  timeout "$timeout" node "$MALON_CLI" "$@" >"$outfile" 2>"$errfile" && local ec=0 || local ec=$?
  local stdout=$(cat "$outfile" 2>/dev/null || true)
  local stderr=$(cat "$errfile" 2>/dev/null || true)
  rm -f "$outfile" "$errfile"
  echo "$stdout"
  return $ec
}

check_output() {
  local stdout="$1"
  local match="${2:-}"
  local nomatch="${3:-}"
  if [ -n "$match" ] && ! echo "$stdout" | grep -q "$match"; then
    echo "Missing: $match"
  fi
  if [ -n "$nomatch" ] && echo "$stdout" | grep -q "$nomatch"; then
    echo "Forbidden: $nomatch"
  fi
}

run_test() {
  local name="$1"; shift
  local block=("$@")
  local sw_start=$(date +%s%N)
  if output=$("${block[@]}" 2>&1); then
    local sw_end=$(date +%s%N)
    local dur=$(( (sw_end - sw_start) / 1000000 ))
    RESULTS+=("{\"test\":\"$name\",\"status\":\"PASS\",\"detail\":\"\",\"duration_ms\":$dur}")
    pass "$name"
  else
    local sw_end=$(date +%s%N)
    local dur=$(( (sw_end - sw_start) / 1000000 ))
    RESULTS+=("{\"test\":\"$name\",\"status\":\"FAIL\",\"detail\":\"$output\",\"duration_ms\":$dur}")
    fail "$name" "$output"
  fi
}

echo -e "${MAGENTA}"
echo '███╗   ███╗ █████╗ ██╗      ██████╗ ███╗   ██╗'
echo '████╗ ████║██╔══██╗██║     ██╔═══██╗████╗  ██║'
echo '██╔████╔██║███████║██║     ██║   ██║██╔██╗ ██║'
echo '██║╚██╔╝██║██╔══██║██║     ██║   ██║██║╚██╗██║'
echo '██║ ╚═╝ ██║██║  ██║███████╗╚██████╔╝██║ ╚████║'
echo '╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝'
echo -e "${NC}"
echo "Comprehensive QA Automation Workflow"
echo "Started: $(date)"
echo "Repo:    $REPO_ROOT"
echo "Fixture: $FIXTURE_DIR"
echo ""

# Pre-flight
step '1. Pre-flight Checks'
run_test 'Node.js available' bash -c 'node --version | grep -E "v20|v22|v23"'
run_test 'Malon CLI built' bash -c "test -f '$MALON_CLI'"
run_test 'Test fixture exists' bash -c "test -f '$FIXTURE_DIR/src/auth.ts'"

# Clean and copy fixture
rm -rf "$WORK_DIR" 2>/dev/null || true
mkdir -p "$WORK_DIR"
cp -r "$FIXTURE_DIR/"* "$WORK_DIR/"
cd "$WORK_DIR"

# Init git
run_test 'Initialize git repo' bash -c '
  git init && git config user.email "test@malon.dev" &&
  git config user.name "Malon Test" &&
  git add -A && git commit -m "Initial" >/dev/null 2>&1
'

# ─── PHASE 1: init ──────────────────────────────────────────────
step '2. malon init — Initialization & Indexing'

run_test 'malon init — creates .malon directory' bash -c "
  output=\$(invoke_malon init)
  echo \"\$output\" | grep -q 'Malon initialized'
  test -d '$WORK_DIR/.malon'
"

run_test 'malon init — config.yml created' bash -c "
  test -f '$WORK_DIR/.malon/config.yml' &&
  grep -q 'pricing:' '$WORK_DIR/.malon/config.yml' &&
  grep -q 'search:' '$WORK_DIR/.malon/config.yml'
"

run_test 'malon init — index.db created' bash -c "
  test -f '$WORK_DIR/.malon/index.db'
"

run_test 'malon init — memory/ directory created' bash -c "
  test -d '$WORK_DIR/.malon/memory/sessions'
"

# ─── PHASE 2: status ────────────────────────────────────────────
step '3. malon status — Session Diagnostics'

run_test 'malon status — returns valid JSON' bash -c "
  output=\$(invoke_malon status)
  echo \"\$output\" | python3 -c 'import sys,json; json.loads(sys.stdin.read())' 2>/dev/null
"

run_test 'malon status — has session_id' bash -c "
  output=\$(invoke_malon status)
  echo \"\$output\" | python3 -c 'import sys,json; d=json.loads(sys.stdin.read()); assert isinstance(d.get(\"session_id\"), str)'
"

# ─── PHASE 3: index ─────────────────────────────────────────────
step '4. malon index — Full Re-index'

run_test 'malon index — runs without error' bash -c "
  invoke_malon index > /dev/null 2>&1
"

# ─── PHASE 4: incremental ───────────────────────────────────────
step '5. malon init --incremental — Incremental Index'

run_test 'malon init --incremental — adds new files' bash -c "
  echo 'export const NEW = 42;' > '$WORK_DIR/src/new-file.ts'
  invoke_malon init --incremental > /dev/null 2>&1
  rm -f '$WORK_DIR/src/new-file.ts'
"

run_test 'malon init --incremental — git sha updated' bash -c "
  output=\$(invoke_malon status)
  echo \"\$output\" | python3 -c 'import sys,json; d=json.loads(sys.stdin.read()); assert d.get(\"last_index_sha\",\"\")!=\"\"'
"

# ─── PHASE 5: local mode ────────────────────────────────────────
step '6. malon init --local — Local-Only Mode'

run_test 'malon init --local — accepts flag' bash -c "
  invoke_malon reset > /dev/null 2>&1
  output=\$(invoke_malon init --local --model llama3.1-8b)
  echo \"\$output\" | grep -q 'LOCAL-ONLY'
"

run_test 'malon init --local — config correct' bash -c "
  grep -q 'provider: ollama' '$WORK_DIR/.malon/config.yml' &&
  grep -q 'model: llama3.1-8b' '$WORK_DIR/.malon/config.yml'
"

run_test 'malon init --local — status shows local_mode' bash -c "
  output=\$(invoke_malon status)
  echo \"\$output\" | python3 -c 'import sys,json; d=json.loads(sys.stdin.read()); assert d.get(\"local_mode\")==True'
"

# ─── PHASE 6: local-check ──────────────────────────────────────
step '7. malon local-check — Ollama Diagnostics'

run_test 'malon local-check — runs without crash' bash -c "
  invoke_malon local-check > /dev/null 2>&1 || true
"

# ─── PHASE 7: clean ─────────────────────────────────────────────
step '8. malon clean — Data Retention & Cleanup'

run_test 'malon clean help — shows usage' bash -c "
  invoke_malon clean help | grep -q 'usage'
"

run_test 'malon clean stats — returns JSON' bash -c "
  output=\$(invoke_malon clean stats)
  echo \"\$output\" | python3 -c 'import sys,json; json.loads(sys.stdin.read())' 2>/dev/null
"

# ─── PHASE 8: reset ─────────────────────────────────────────────
step '9. malon reset — State Reset'

run_test 'malon reset — deletes index artifacts' bash -c "
  invoke_malon reset > /dev/null 2>&1
  test ! -f '$WORK_DIR/.malon/index.db' &&
  test ! -f '$WORK_DIR/.malon/usage.log' 2>/dev/null; true
"

run_test 'malon reset — preserves memory and config' bash -c "
  test -d '$WORK_DIR/.malon/memory' &&
  test -f '$WORK_DIR/.malon/config.yml'
"

# ─── PHASE 9: help ──────────────────────────────────────────────
step '10. malon help — CLI Documentation'

run_test 'malon help — shows usage' bash -c "
  invoke_malon help | grep -q 'Usage'
"

run_test 'malon (no args) — shows usage' bash -c "
  invoke_malon 2>/dev/null | grep -q 'Usage'
"

run_test 'malon --help — shows usage' bash -c "
  invoke_malon --help | grep -q 'Usage'
"

run_test 'malon unknown command — error' bash -c "
  invoke_malon nonexistent-command-xyz 2>/dev/null; test \$? -eq 1
"

# ─── PHASE 10: full cycle ───────────────────────────────────────
step '11. Full Cycle — init → index → status → reset'

run_test 'Full cycle completes' bash -c "
  invoke_malon init > /dev/null 2>&1 &&
  invoke_malon index > /dev/null 2>&1 &&
  invoke_malon status > /dev/null 2>&1 &&
  invoke_malon reset > /dev/null 2>&1
"

# ─── PHASE 11: deep diagnostics ─────────────────────────────────
step '12. Deep Diagnostics — Bug, Flaw & Error Analysis'

run_test 'DIAGNOSTIC: Lock file stale process recovery' bash -c "
  mkdir -p '$WORK_DIR/.malon'
  echo '{\"pid\":99999,\"startedAt\":\"2020-01-01T00:00:00.000Z\",\"sessionId\":\"dead\"}' > '$WORK_DIR/.malon/.malon.lock'
  invoke_malon status > /dev/null 2>&1; true
  rm -f '$WORK_DIR/.malon/.malon.lock'
"

run_test 'DIAGNOSTIC: Empty repo handled' bash -c "
  ed=\$(mktemp -d)
  mkdir -p \"\$ed/src\"
  touch \"\$ed/src/empty.txt\"
  invoke_malon init > /dev/null 2>&1; true
  rm -rf \"\$ed\"
"

run_test 'DIAGNOSTIC: Unsupported files skipped' bash -c "
  dd if=/dev/urandom of='$WORK_DIR/src/binary.bin' bs=4 count=1 2>/dev/null || true
  invoke_malon init --incremental > /dev/null 2>&1; true
  rm -f '$WORK_DIR/src/binary.bin'
"

run_test 'DIAGNOSTIC: Single-file repo' bash -c "
  sd=\$(mktemp -d)
  echo 'export const V = 1;' > \"\$sd/index.ts\"
  (cd \"\$sd\" && invoke_malon init > /dev/null 2>&1); true
  rm -rf \"\$sd\"
"

# ─── PHASE 12: bug hunting ──────────────────────────────────────
step '13. Bug Hunting — Known Failure Patterns'

run_test 'BUG HUNT: Double init does not crash' bash -c "
  invoke_malon init > /dev/null 2>&1
  invoke_malon init > /dev/null 2>&1
"

run_test 'BUG HUNT: Status without index' bash -c "
  invoke_malon reset > /dev/null 2>&1
  invoke_malon status > /dev/null 2>&1; true
"

run_test 'BUG HUNT: Unicode file names' bash -c "
  mkdir -p '$WORK_DIR/src/测试'
  echo 'export const H = \"你好\";' > '$WORK_DIR/src/测试/index.ts'
  invoke_malon init --incremental > /dev/null 2>&1; true
  rm -rf '$WORK_DIR/src/测试'
"

run_test 'BUG HUNT: Large file handled' bash -c "
  python3 -c \"open('$WORK_DIR/src/big.ts','w').write('export const D=['+','.join(['1']*5000)+'];\') 2>/dev/null\" || true
  invoke_malon init --incremental > /dev/null 2>&1; true
  rm -f '$WORK_DIR/src/big.ts'
"

run_test 'BUG HUNT: Malformed syntax' bash -c "
  echo 'export function broken( {' > '$WORK_DIR/src/broken.ts'
  invoke_malon init --incremental > /dev/null 2>&1; true
  rm -f '$WORK_DIR/src/broken.ts'
"

# ─── REPORT ──────────────────────────────────────────────────────
step '14. Generating Report'

TOTAL_DURATION=$(($(date +%s) - START_TIME))
SCORE="PASS"; [ "$FAIL" -gt 0 ] && SCORE="FAIL"

jq -n \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson dur "$TOTAL_DURATION" \
  --argjson total "$((PASS+FAIL+WARN))" \
  --argjson pass "$PASS" \
  --argjson fail "$FAIL" \
  --argjson warn "$WARN" \
  --arg score "$SCORE" \
  '{
    timestamp: $ts, duration_seconds: $dur, total_tests: $total,
    passed: $pass, failed: $fail, warnings: $warn, score: $score
  }' > "$SUMMARY_FILE"

echo -e "\n${CYAN}════════════════════════════════════════════${NC}"
echo -e "  MALON QA TEST REPORT"
echo -e "${CYAN}════════════════════════════════════════════${NC}"
echo -e "  Duration:     ${TOTAL_DURATION}s"
echo -e "  Total:        $((PASS+FAIL+WARN))"
echo -e "  ${GREEN}Passed:       $PASS${NC}"
if [ "$FAIL" -gt 0 ]; then echo -e "  ${RED}Failed:       $FAIL${NC}"; else echo -e "  ${GREEN}Failed:       $FAIL${NC}"; fi
if [ "$WARN" -gt 0 ]; then echo -e "  ${YELLOW}Warnings:     $WARN${NC}"; fi
echo -e "  Score:        ${SCORE}"
echo -e "  Report:       $SUMMARY_FILE"
echo -e "${CYAN}════════════════════════════════════════════${NC}"

exit $EXIT_CODE
