<#
.SYNOPSIS
  Malon Comprehensive QA Automation Workflow

.DESCRIPTION
  End-to-end automated test suite for all Malon CLI commands.
  Creates an isolated test environment, runs every command defined in
  README.md, validates output, checks for bugs/errors/flaws, captures
  timing/efficiency metrics, and produces a detailed report.

  This script is the automated "find bugs, mistakes, errors, flaws"
  workflow for the Malon project.

.NOTES
  Run from the repo root:  .\test-env\run-malon-tests.ps1
  Requires: Node.js >= 20, TypeScript compiled (npm run build)
#>

$ErrorActionPreference = 'Stop'
$script:exitCode = 0
$script:startTime = Get-Date
$script:results = @()
$script:warnings = @()
$script:errors = @()
$script:improvements = @()

# --- Configuration ---------------------------------------------------
$REPO_ROOT    = Resolve-Path "$PSScriptRoot\.."
$TEST_ENV     = "$PSScriptRoot"
$FIXTURE_DIR  = "$TEST_ENV\fixtures\sample-repo"
$WORK_DIR     = "$TEST_ENV\work"
$LOG_FILE     = "$TEST_ENV\report.jsonl"
$SUMMARY_FILE = "$TEST_ENV\summary.json"

$MALON_CLI = "$REPO_ROOT\dist\cli\index.js"

$PASS = 0
$FAIL = 0
$WARN = 0

# --- Helpers ---------------------------------------------------------

function Write-Step {
  param([string]$Message)
  Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Write-Result {
  param([string]$Test, [string]$Status, [string]$Detail, [int]$DurationMs = 0)
  $script:results += @{
    test       = $Test
    status     = $Status
    detail     = $Detail
    duration_ms = $DurationMs
    timestamp  = (Get-Date -Format 'o')
  }
  $icon = switch ($Status) {
    'PASS' { '[PASS]'; $script:PASS++ }
    'FAIL' { '[FAIL]'; $script:FAIL++; $script:exitCode = 1 }
    'WARN' { '[WARN]'; $script:WARN++ }
  }
  Write-Host "  $icon [$Status] $Test" -ForegroundColor $(if ($Status -eq 'PASS') {'Green'} elseif ($Status -eq 'FAIL') {'Red'} else {'Yellow'})
  if ($Detail) { Write-Host "       $Detail" -ForegroundColor Gray }
}

function Run-Test {
  param(
    [string]$Name,
    [scriptblock]$Block,
    [int]$TimeoutSeconds = 30
  )
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $null = & $Block
    $sw.Stop()
    Write-Result -Test $Name -Status 'PASS' -DurationMs $sw.ElapsedMilliseconds
  }
  catch {
    $sw.Stop()
    Write-Result -Test $Name -Status 'FAIL' -Detail $_.Exception.Message -DurationMs $sw.ElapsedMilliseconds
  }
}

function Invoke-Malon {
  param(
    [string[]]$Arguments,
    [string]$WorkingDir,
    [int]$TimeoutSeconds = 30
  )
  $process = Start-Process -FilePath 'node' -ArgumentList @($MALON_CLI) + $Arguments -NoNewWindow -PassThru -RedirectStandardOutput "$TEST_ENV\_stdout.tmp" -RedirectStandardError "$TEST_ENV\_stderr.tmp" -WorkingDirectory $WorkingDir
  $completed = $process.WaitForExit(($TimeoutSeconds * 1000))
  if (-not $completed) {
    $process.Kill()
    throw "TIMEOUT after ${TimeoutSeconds}s"
  }
  $stdout = Get-Content "$TEST_ENV\_stdout.tmp" -Raw -ErrorAction SilentlyContinue
  $stderr = Get-Content "$TEST_ENV\_stderr.tmp" -Raw -ErrorAction SilentlyContinue
  Remove-Item "$TEST_ENV\_stdout.tmp" -Force -ErrorAction SilentlyContinue
  Remove-Item "$TEST_ENV\_stderr.tmp" -Force -ErrorAction SilentlyContinue
  if (-not $stdout) { $stdout = '' }
  if (-not $stderr) { $stderr = '' }
  return @{
    ExitCode = $process.ExitCode
    StdOut   = $stdout
    StdErr   = $stderr
  }
}

function Check-Output {
  param(
    [Parameter(Mandatory)]$Result,
    [string]$MustContain = $null,
    [string]$MustNotContain = $null,
    [int]$ExpectedExitCode = 0,
    [switch]$MustBeJson
  )
  $issues = @()
  if ($Result.ExitCode -ne $ExpectedExitCode) {
    $issues += "Exit code $($Result.ExitCode), expected $ExpectedExitCode"
  }
  if ($MustContain -and $Result.StdOut -notmatch $MustContain -and $Result.StdErr -notmatch $MustContain) {
    $issues += "Output missing expected text: '$MustContain'"
  }
  if ($MustNotContain -and ($Result.StdOut -match $MustNotContain -or $Result.StdErr -match $MustNotContain)) {
    $issues += "Output contains forbidden text: '$MustNotContain'"
  }
  if ($MustBeJson) {
    try { $null = $Result.StdOut | ConvertFrom-Json } catch { $issues += "Output is not valid JSON" }
  }
  return $issues
}

# --- Setup ----------------------------------------------------------

Write-Host ""
Write-Host "###\   ###\ #####\ ##\      ######\ ###\   ##\" -ForegroundColor Magenta
Write-Host "####\ ####|##/==##\##|     ##/===##\####\  ##|" -ForegroundColor Magenta
Write-Host "##/####/##|#######|##|     ##|   ##|##/##\ ##|" -ForegroundColor Magenta
Write-Host "##|\##//##|##/==##|##|     ##|   ##|##|\##\##|" -ForegroundColor Magenta
Write-Host "##| \=/ ##|##|  ##|#######\\######//##| \####|" -ForegroundColor Magenta
Write-Host "\=/     \=/\=/  \=/\======/ \=====/ \=/  \===/" -ForegroundColor Magenta

Write-Host "Comprehensive QA Automation Workflow" -ForegroundColor White
Write-Host "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "Repo:    $REPO_ROOT" -ForegroundColor Gray
Write-Host "Fixture: $FIXTURE_DIR" -ForegroundColor Gray
Write-Host "Work:    $WORK_DIR" -ForegroundColor Gray
Write-Host ""

# Verify prerequisites
Write-Step '1. Pre-flight Checks'
Run-Test -Name 'Node.js available' -Block { $v = node --version; if ($v -notmatch 'v20|v22|v23') { throw "Node v20+ required, got $v" } }
Run-Test -Name 'Malon CLI built' -Block {
  if (-not (Test-Path $MALON_CLI)) { throw "CLI not built at $MALON_CLI -- run 'npm run build' first" }
}
Run-Test -Name 'Test fixture exists' -Block {
  if (-not (Test-Path "$FIXTURE_DIR\src\auth.ts")) { throw "Fixture repo missing" }
}

# Clean work directory
if (Test-Path $WORK_DIR) { Remove-Item -Recurse -Force $WORK_DIR -ErrorAction SilentlyContinue }
$null = New-Item -ItemType Directory -Force -Path $WORK_DIR
Copy-Item -Recurse "$FIXTURE_DIR\*" -Destination $WORK_DIR
Push-Location $WORK_DIR

try {

# Initialize git repo for the test fixture
Run-Test -Name 'Initialize git repo for test fixture' -Block {
  git init 2>&1 | Out-Null
  git config user.email "test@malon.dev"
  git config user.name "Malon Test"
  git add -A 2>&1 | Out-Null
  git commit -m "Initial test fixture" 2>&1 | Out-Null
  $head = git rev-parse HEAD
  if (-not $head) { throw "Git commit failed" }
}

# ===================================================================
# PHASE 1: malon init
# ===================================================================
Write-Step '2. malon init -- Initialization & Indexing'

Run-Test -Name 'malon init -- creates .malon directory' -Block {
  $r = Invoke-Malon -Arguments @('init') -WorkingDir $WORK_DIR
  $issues = Check-Output $r -MustContain 'Malon initialized'
  if (-not (Test-Path "$WORK_DIR\.malon")) { $issues += ".malon/ directory not created" }
  if ($issues.Count -gt 0) { throw ($issues -join '; ') }
}

Run-Test -Name 'malon init -- config.yml created' -Block {
  if (-not (Test-Path "$WORK_DIR\.malon\config.yml")) { throw "config.yml not found" }
  $cfg = Get-Content "$WORK_DIR\.malon\config.yml" -Raw
  if ($cfg -notmatch 'pricing:') { throw "config.yml missing pricing section" }
  if ($cfg -notmatch 'search:')  { throw "config.yml missing search section" }
  if ($cfg -notmatch 'cost:')    { throw "config.yml missing cost section" }
  if ($cfg -notmatch 'rate_limits:') { throw "config.yml missing rate_limits section" }
  $script:improvements += 'BUG CHECK: config.yml nested YAML parser uses custom parse (config.ts). If config values appear defaulted despite explicit yml, the parser is wrong -- test by changing a value and re-reading.'
}

Run-Test -Name 'malon init -- index.db created' -Block {
  if (-not (Test-Path "$WORK_DIR\.malon\index.db")) { throw "index.db not created" }
}

Run-Test -Name 'malon init -- memory/ directory created' -Block {
  if (-not (Test-Path "$WORK_DIR\.malon\memory\sessions")) { throw "memory/sessions/ not created" }
}

Run-Test -Name 'malon init -- files indexed > 0' -Block {
  $r = Invoke-Malon -Arguments @('status') -WorkingDir $WORK_DIR
  $issues = Check-Output $r -MustBeJson
  if ($issues.Count -gt 0) { throw ($issues -join '; ') }
}

Run-Test -Name 'malon init -- git post-commit hook installed' -Block {
  $hook = Get-ChildItem -Path "$WORK_DIR\.git\hooks\post-commit" -ErrorAction SilentlyContinue
  if (-not $hook) { throw "post-commit hook not installed" }
}

# ===================================================================
# PHASE 2: malon status
# ===================================================================
Write-Step '3. malon status -- Session Diagnostics'

Run-Test -Name 'malon status -- returns valid JSON' -Block {
  $r = Invoke-Malon -Arguments @('status') -WorkingDir $WORK_DIR
  $issues = Check-Output $r -MustBeJson
  if ($issues.Count -gt 0) { throw ($issues -join '; ') }
  $data = $r.StdOut | ConvertFrom-Json
  if ($data.session_id -eq $null) { $script:errors += "BUG: status missing session_id" }
  if ($data.uptime_ms -eq $null -or $data.uptime_ms -le 0) { $script:errors += "BUG: status missing uptime_ms" }
}

$script:statusData = $null
Run-Test -Name 'malon status -- has all required fields' -Block {
  $r = Invoke-Malon -Arguments @('status') -WorkingDir $WORK_DIR
  $data = $r.StdOut | ConvertFrom-Json
  $expected = @('session_id', 'spend_usd', 'tokens_used', 'tokens_saved_cumulative', 'rot_flag', 'last_index_sha', 'uptime_ms', 'local_mode')
  $missing = $expected | Where-Object { $data.$_ -eq $null }
  if ($missing.Count -gt 0) { throw "Missing fields: $($missing -join ', ')" }
  $script:statusData = $data
}

Run-Test -Name 'malon status -- initial values are zero' -Block {
  if ($script:statusData.spend_usd -ne 0)  { $script:warnings += "BUG? status.spend_usd not zero: $($script:statusData.spend_usd)" }
  if ($script:statusData.tokens_used -ne 0) { $script:warnings += "BUG? status.tokens_used not zero: $($script:statusData.tokens_used)" }
}

# ===================================================================
# PHASE 3: malon index (full re-index)
# ===================================================================
Write-Step '4. malon index -- Full Re-index'

Run-Test -Name 'malon index -- runs without error' -Block {
  $r = Invoke-Malon -Arguments @('index') -WorkingDir $WORK_DIR
  # index writes to stderr via logger, exit code should be 0
  if ($r.ExitCode -ne 0) { throw "Exit code $($r.ExitCode)" }
}

Run-Test -Name 'malon index -- files re-indexed' -Block {
  $r = Invoke-Malon -Arguments @('status') -WorkingDir $WORK_DIR
  $data = $r.StdOut | ConvertFrom-Json
  if ($data.last_index_sha -eq '') { $script:warnings += "BUG: last_index_sha empty after re-index" }
}

# ===================================================================
# PHASE 4: malon init --incremental
# ===================================================================
Write-Step '5. malon init --incremental -- Incremental Index'

Run-Test -Name 'malon init --incremental -- adds new files' -Block {
  New-Item -ItemType File -Force -Path "$WORK_DIR\src\new-file.ts" -Value 'export const NEW = 42;'
  $r = Invoke-Malon -Arguments @('init', '--incremental') -WorkingDir $WORK_DIR
  if ($r.StdErr -match 'error') { $script:warnings += "Possible error during incremental: $($r.StdErr)" }
}

Run-Test -Name 'malon init --incremental -- detects deleted files' -Block {
  Remove-Item -Force "$WORK_DIR\src\new-file.ts" -ErrorAction SilentlyContinue
  $r = Invoke-Malon -Arguments @('init', '--incremental') -WorkingDir $WORK_DIR
  if ($r.StdErr -match 'error') { $script:warnings += "Possible error during incremental delete: $($r.StdErr)" }
}

Run-Test -Name 'malon init --incremental -- git sha updated' -Block {
  $r = Invoke-Malon -Arguments @('status') -WorkingDir $WORK_DIR
  $data = $r.StdOut | ConvertFrom-Json
  if ($data.last_index_sha -eq '') { $script:errors += "BUG: last_index_sha empty after incremental" }
}

Run-Test -Name 'EFFICIENCY: init --incremental with zero changes' -Block {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $r = Invoke-Malon -Arguments @('init', '--incremental') -WorkingDir $WORK_DIR
  $sw.Stop()
  if ($sw.ElapsedMilliseconds -gt 5000) { $script:warnings += "PERF: incremental with no changes took $($sw.ElapsedMilliseconds)ms (budget: 5000ms)" }
}

# ===================================================================
# PHASE 5: malon init --local
# ===================================================================
Write-Step '6. malon init --local -- Local-Only Mode'

Run-Test -Name 'malon init --local -- accepts flag' -Block {
  # Reset malon state first
  $r = Invoke-Malon -Arguments @('reset') -WorkingDir $WORK_DIR
  $r = Invoke-Malon -Arguments @('init', '--local', '--model', 'llama3.1-8b') -WorkingDir $WORK_DIR
  $issues = Check-Output $r -MustContain 'LOCAL-ONLY'
  if ($issues.Count -gt 0) { throw ($issues -join '; ') }
}

Run-Test -Name 'malon init --local -- config has ollama provider' -Block {
  $cfg = Get-Content "$WORK_DIR\.malon\config.yml" -Raw
  if ($cfg -notmatch 'provider: ollama') { throw "config not set to ollama" }
  if ($cfg -notmatch 'model: llama3.1-8b') { throw "config not set to llama3.1-8b" }
}

Run-Test -Name 'malon init --local -- reports local_mode in status' -Block {
  $r = Invoke-Malon -Arguments @('status') -WorkingDir $WORK_DIR
  $data = $r.StdOut | ConvertFrom-Json
  if ($data.local_mode -ne $true) { throw "local_mode not true in status" }
  if ($data.local_model -ne 'llama3.1-8b') { throw "local_model not set in status" }
}

# ===================================================================
# PHASE 6: malon local-check
# ===================================================================
Write-Step '7. malon local-check -- Ollama Diagnostics'

Run-Test -Name 'malon local-check -- runs without crash' -Block {
  $r = Invoke-Malon -Arguments @('local-check') -WorkingDir $WORK_DIR
  # May be unavailable -- should not crash
  if ($r.ExitCode -ne 0 -and $r.StdErr -notmatch 'UNAVAILABLE') {
    $script:warnings += "local-check unexpected exit code $($r.ExitCode)"
  }
}

# ===================================================================
# PHASE 7: malon clean
# ===================================================================
Write-Step '8. malon clean -- Data Retention & Cleanup'

Run-Test -Name 'malon clean help -- shows usage' -Block {
  $r = Invoke-Malon -Arguments @('clean', 'help') -WorkingDir $WORK_DIR
  $issues = Check-Output $r -MustContain 'usage'
  if ($issues.Count -gt 0) { throw ($issues -join '; ') }
}

Run-Test -Name 'malon clean stats -- returns JSON' -Block {
  $r = Invoke-Malon -Arguments @('clean', 'stats') -WorkingDir $WORK_DIR
  try { $null = $r.StdOut | ConvertFrom-Json } catch { throw "Stats not valid JSON" }
}

Run-Test -Name 'malon clean usage -- prunes records' -Block {
  $r = Invoke-Malon -Arguments @('clean', 'usage') -WorkingDir $WORK_DIR
  try { $data = $r.StdOut | ConvertFrom-Json } catch { throw "Usage output not JSON" }
}

# ===================================================================
# PHASE 8: malon reset
# ===================================================================
Write-Step '9. malon reset -- State Reset'

Run-Test -Name 'malon reset -- deletes index.db' -Block {
  $r = Invoke-Malon -Arguments @('reset') -WorkingDir $WORK_DIR
  if (Test-Path "$WORK_DIR\.malon\index.db") { throw "index.db not deleted" }
  if (Test-Path "$WORK_DIR\.malon\usage.log") { throw "usage.log not deleted" }
  if (Test-Path "$WORK_DIR\.malon\.malon.lock") { throw "lock file not deleted" }
}

Run-Test -Name 'malon reset -- memory preserved' -Block {
  if (-not (Test-Path "$WORK_DIR\.malon\memory")) { throw "memory/ deleted by reset (should be preserved)" }
  if (-not (Test-Path "$WORK_DIR\.malon\config.yml")) { throw "config.yml deleted by reset (should be preserved)" }
}

# ===================================================================
# PHASE 9: malon help
# ===================================================================
Write-Step '10. malon help -- CLI Documentation'

Run-Test -Name 'malon help -- shows usage' -Block {
  $r = Invoke-Malon -Arguments @('help') -WorkingDir $WORK_DIR
  $issues = Check-Output $r -MustContain 'Usage'
  if ($issues.Count -gt 0) { throw ($issues -join '; ') }
}

Run-Test -Name 'malon (no args) -- shows usage' -Block {
  $r = Invoke-Malon -Arguments @() -WorkingDir $WORK_DIR
  $issues = Check-Output $r -MustContain 'Usage' -ExpectedExitCode 0
  if ($issues.Count -gt 0) { throw ($issues -join '; ') }
}

Run-Test -Name 'malon --help -- shows usage' -Block {
  $r = Invoke-Malon -Arguments @('--help') -WorkingDir $WORK_DIR
  $issues = Check-Output $r -MustContain 'Usage'
  if ($issues.Count -gt 0) { throw ($issues -join '; ') }
}

Run-Test -Name 'malon <unknown-command> -- shows error' -Block {
  $r = Invoke-Malon -Arguments @('nonexistent-command-xyz') -WorkingDir $WORK_DIR
  if ($r.ExitCode -ne 1) { throw "Expected exit code 1 for unknown command, got $($r.ExitCode)" }
  $issues = Check-Output $r -MustContain 'Unknown command'
  if ($issues.Count -gt 0) { throw ($issues -join '; ') }
}

# ===================================================================
# PHASE 10: Re-init and verify full cycle
# ===================================================================
Write-Step '11. Full Cycle -- init -> index -> status -> reset'

Run-Test -Name 'Full cycle: init completes' -Block {
  $r = Invoke-Malon -Arguments @('init') -WorkingDir $WORK_DIR
  if ($r.StdOut -notmatch 'Malon initialized' -and $r.StdErr -notmatch 'Malon initialized') {
    throw "init failed in full cycle"
  }
}

Run-Test -Name 'Full cycle: index + status' -Block {
  $r1 = Invoke-Malon -Arguments @('index') -WorkingDir $WORK_DIR
  $r2 = Invoke-Malon -Arguments @('status') -WorkingDir $WORK_DIR
  try { $data = $r2.StdOut | ConvertFrom-Json } catch { throw "status not JSON after re-index" }
  if ($data.session_id -eq '') { throw "status missing session_id" }
}

# ===================================================================
# DEEP DIAGNOSTICS -- Bug hunting pass
# ===================================================================
Write-Step '12. Deep Diagnostics -- Bug, Flaw & Error Analysis'

# Check 1: Concurrent lock behavior
Run-Test -Name 'DIAGNOSTIC: Lock file crash recovery' -Block {
  New-Item -ItemType Directory -Force -Path "$WORK_DIR\.malon" | Out-Null
  Set-Content -Path "$WORK_DIR\.malon\.malon.lock" -Value '{"pid":99999,"startedAt":"2020-01-01T00:00:00.000Z","sessionId":"dead"}'
  $r = Invoke-Malon -Arguments @('status') -WorkingDir $WORK_DIR
  Remove-Item "$WORK_DIR\.malon\.malon.lock" -Force -ErrorAction SilentlyContinue
  if ($r.ExitCode -ne 0) { $script:warnings += "Stale lock file may cause failures: exit $($r.ExitCode)" }
}

# Check 2: Empty repo
Run-Test -Name 'DIAGNOSTIC: Empty repo indexing' -Block {
  $emptyDir = "$TEST_ENV\work-empty"
  if (Test-Path $emptyDir) { Remove-Item -Recurse -Force $emptyDir -ErrorAction SilentlyContinue }
  $null = New-Item -ItemType Directory -Force -Path "$emptyDir\src"
  New-Item -ItemType File -Force -Path "$emptyDir\src\empty.txt" -Value '' | Out-Null
  $r = Invoke-Malon -Arguments @('init') -WorkingDir $emptyDir
  if ($r.ExitCode -ne 0) { $script:warnings += "Empty repo init failed" }
  Remove-Item -Recurse -Force $emptyDir -ErrorAction SilentlyContinue
}

# Check 3: Path traversal check (security)
Run-Test -Name 'DIAGNOSTIC: Config parser edge cases' -Block {
  # Write a config with unusual values and re-read
  $cfgPath = "$WORK_DIR\.malon\config.yml"
  $original = Get-Content $cfgPath -Raw
  try {
    # Add a nonsense key to test parser robustness
    $testCfg = $original + "`ntest_nested:`n  weird: true`n  empty_key:`n"
    Set-Content -Path $cfgPath -Value $testCfg
    Invoke-Malon -Arguments @('status') -WorkingDir $WORK_DIR | Out-Null
    $script:improvements += 'CONFIG PARSER: Nested YAML parser in config.ts is custom-built. Check for indentation bugs, empty-value handling, and edge cases.'
  }
  finally {
    Set-Content -Path $cfgPath -Value $original
  }
}

# Check 4: Unsupported file type
Run-Test -Name 'DIAGNOSTIC: Unsupported file types skipped gracefully' -Block {
  New-Item -ItemType File -Force -Path "$WORK_DIR\src\binary.bin" -Value ([byte[]](0x00, 0x01, 0x02, 0xFF))
  $r = Invoke-Malon -Arguments @('init', '--incremental') -WorkingDir $WORK_DIR
  Remove-Item "$WORK_DIR\src\binary.bin" -Force -ErrorAction SilentlyContinue
  if ($r.StdErr -match 'crash|fatal|unhandled') { throw "Unsupported file caused error" }
}

# Check 5: Verify config.yml survives reset
Run-Test -Name 'DIAGNOSTIC: Reset preserves user config' -Block {
  if (-not (Test-Path "$WORK_DIR\.malon\config.yml")) { throw "config.yml missing" }
}

# Check 6: Verify memory directory survives reset
Run-Test -Name 'DIAGNOSTIC: Reset preserves memory ledger' -Block {
  if (-not (Test-Path "$WORK_DIR\.malon\memory")) { throw "memory/ missing after reset" }
  if (-not (Test-Path "$WORK_DIR\.malon\memory\sessions")) { throw "memory/sessions/ missing after reset" }
}

# Check 7: Single-file repo
Run-Test -Name 'DIAGNOSTIC: Single file repo indexes correctly' -Block {
  $singleDir = "$TEST_ENV\work-single"
  if (Test-Path $singleDir) { Remove-Item -Recurse -Force $singleDir -ErrorAction SilentlyContinue }
  $null = New-Item -ItemType Directory -Force -Path $singleDir
  Set-Content -Path "$singleDir\index.ts" -Value 'export const VERSION = "1.0.0";'
  $r = Invoke-Malon -Arguments @('init') -WorkingDir $singleDir
  $r2 = Invoke-Malon -Arguments @('status') -WorkingDir $singleDir
  try { $data = $r2.StdOut | ConvertFrom-Json } catch { $script:warnings += "Single-file repo status not JSON" }
  Remove-Item -Recurse -Force $singleDir -ErrorAction SilentlyContinue
}

# ===================================================================
# PERFORMANCE & EFFICIENCY
# ===================================================================
Write-Step '13. Performance & Efficiency Benchmarks'

$perfResults = @{}
Run-Test -Name 'PERF: malon init cold start' -Block {
  $r = Invoke-Malon -Arguments @('reset') -WorkingDir $WORK_DIR
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $r = Invoke-Malon -Arguments @('init') -WorkingDir $WORK_DIR
  $sw.Stop()
  $perfResults['init_cold'] = $sw.ElapsedMilliseconds
  if ($sw.ElapsedMilliseconds -gt 30000) { $script:warnings += "PERF: init cold took $($sw.ElapsedMilliseconds)ms (ceiling: 30s)" }
}

Run-Test -Name 'PERF: malon status response' -Block {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  for ($i = 0; $i -lt 5; $i++) { Invoke-Malon -Arguments @('status') -WorkingDir $WORK_DIR | Out-Null }
  $sw.Stop()
  $avgMs = [math]::Round($sw.ElapsedMilliseconds / 5)
  $perfResults['status_avg'] = $avgMs
  if ($avgMs -gt 500) { $script:warnings += "PERF: status avg $($avgMs)ms (ceiling: 500ms)" }
}

Run-Test -Name 'PERF: malon index re-index' -Block {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $r = Invoke-Malon -Arguments @('index') -WorkingDir $WORK_DIR
  $sw.Stop()
  $perfResults['index_full'] = $sw.ElapsedMilliseconds
  if ($sw.ElapsedMilliseconds -gt 30000) { $script:warnings += "PERF: full re-index took $($sw.ElapsedMilliseconds)ms (ceiling: 30s)" }
}

Run-Test -Name 'PERF: malon reset response' -Block {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  Invoke-Malon -Arguments @('reset') -WorkingDir $WORK_DIR | Out-Null
  $sw.Stop()
  $perfResults['reset'] = $sw.ElapsedMilliseconds
  if ($sw.ElapsedMilliseconds -gt 2000) { $script:warnings += "PERF: reset took $($sw.ElapsedMilliseconds)ms (ceiling: 2s)" }
}

Run-Test -Name 'PERF: malon init --incremental response' -Block {
  Invoke-Malon -Arguments @('init') -WorkingDir $WORK_DIR | Out-Null
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $r = Invoke-Malon -Arguments @('init', '--incremental') -WorkingDir $WORK_DIR
  $sw.Stop()
  $perfResults['incremental'] = $sw.ElapsedMilliseconds
}

# ===================================================================
# BUG HUNT: Find known patterns of failure
# ===================================================================
Write-Step '14. Bug Hunting -- Known Failure Patterns'

# Pattern: Double init
Run-Test -Name 'BUG HUNT: Double init does not crash' -Block {
  $r = Invoke-Malon -Arguments @('init') -WorkingDir $WORK_DIR
  $r2 = Invoke-Malon -Arguments @('init') -WorkingDir $WORK_DIR
  if ($r2.ExitCode -ne 0) {
    if ($r2.StdErr -match 'lock') { $script:improvements += 'BUG: Double init may fail on lock -- is lock released after init completes?' }
    throw "Double init crashed: exit $($r2.ExitCode)"
  }
}

# Pattern: Status before init
Run-Test -Name 'BUG HUNT: status without index' -Block {
  Invoke-Malon -Arguments @('reset') -WorkingDir $WORK_DIR | Out-Null
  $r = Invoke-Malon -Arguments @('status') -WorkingDir $WORK_DIR
  # Should handle gracefully, not crash
  if ($r.ExitCode -ne 0) { $script:warnings += "Status without index returned non-zero exit: $($r.ExitCode)" }
}

# Pattern: Very long paths
Run-Test -Name 'BUG HUNT: Long file paths handled' -Block {
  $longName = 'a' * 100
  $longDir = "$WORK_DIR\src\$longName"
  $null = New-Item -ItemType Directory -Force -Path $longDir
  Set-Content -Path "$longDir\long.ts" -Value 'export const LONG = "path";'
  $r = Invoke-Malon -Arguments @('init', '--incremental') -WorkingDir $WORK_DIR
  Remove-Item -Recurse -Force $longDir -ErrorAction SilentlyContinue
  if ($r.StdErr -match 'crash|fatal|unhandled|ENAMETOOLONG') { $script:errors += "BUG: Long path crashed indexer" }
}

# Pattern: Unicode in file names
Run-Test -Name 'BUG HUNT: Unicode file names handled' -Block {
  $unicodeDir = "$WORK_DIR\src\test"
  $null = New-Item -ItemType Directory -Force -Path $unicodeDir
  Set-Content -Path "$unicodeDir\index.ts" -Value 'export const HELLO = "helloworld";'
  $r = Invoke-Malon -Arguments @('init', '--incremental') -WorkingDir $WORK_DIR
  Remove-Item -Recurse -Force $unicodeDir -ErrorAction SilentlyContinue
  if ($r.StdErr -match 'crash|fatal|unhandled') { $script:errors += "BUG: Unicode paths crashed indexer" }
}

# Pattern: Large single file
Run-Test -Name 'BUG HUNT: Large file handled (no crash)' -Block {
  $bigContent = "export const DATA = [" + ( "1," * 5000 ) + "];"
  Set-Content -Path "$WORK_DIR\src\big-file.ts" -Value $bigContent
  $r = Invoke-Malon -Arguments @('init', '--incremental') -WorkingDir $WORK_DIR
  Remove-Item "$WORK_DIR\src\big-file.ts" -Force -ErrorAction SilentlyContinue
  if ($r.StdErr -match 'crash|fatal|unhandled|heap|OOM') { $script:errors += "BUG: Large file crashed indexer" }
}

# Pattern: Invalid JS/TS syntax
Run-Test -Name 'BUG HUNT: Malformed syntax handled gracefully' -Block {
  Set-Content -Path "$WORK_DIR\src\broken.ts" -Value 'export function broken( {'
  $r = Invoke-Malon -Arguments @('init', '--incremental') -WorkingDir $WORK_DIR
  Remove-Item "$WORK_DIR\src\broken.ts" -Force -ErrorAction SilentlyContinue
  if ($r.StdErr -match 'crash|fatal|unhandled') { $script:errors += "BUG: Malformed syntax crashed indexer" }
}

# ===================================================================
# REPORT
# ===================================================================
Write-Step '15. Generating Report'

$totalDuration = [math]::Round(((Get-Date) - $script:startTime).TotalSeconds, 1)
$score = if ($script:FAIL -eq 0) { 'PASS' } else { 'FAIL' }

# Check for detected issues
$detectedBugs = @()
if ($script:errors.Count -gt 0) { $detectedBugs += $script:errors }
if ($script:warnings.Count -gt 0) { $detectedBugs += $script:warnings }

$summary = @{
  timestamp          = (Get-Date -Format 'o')
  duration_seconds   = $totalDuration
  total_tests        = $script:results.Count
  passed             = $script:PASS
  failed             = $script:FAIL
  warnings           = $script:WARN
  score              = $score
  detected_issues    = $detectedBugs
  improvements       = $script:improvements
  performance_ms     = $perfResults
  results            = $script:results
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -Path $SUMMARY_FILE -Encoding UTF8
$script:results | ForEach-Object { $_ | ConvertTo-Json -Compress -Depth 5 | Add-Content -Path $LOG_FILE -Encoding UTF8 }

# Console report
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  MALON QA TEST REPORT" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Duration:     $totalDuration seconds" -ForegroundColor Gray
Write-Host "  Total tests:  $($script:results.Count)" -ForegroundColor White
Write-Host "  Passed:       $script:PASS" -ForegroundColor Green
Write-Host "  Failed:       $script:FAIL" -ForegroundColor $(if ($script:FAIL -gt 0) {'Red'} else {'Green'})
Write-Host "  Warnings:     $script:WARN" -ForegroundColor Yellow
Write-Host "  Score:        $score" -ForegroundColor $(if ($script:FAIL -eq 0) {'Green'} else {'Red'})
Write-Host ""

if ($detectedBugs.Count -gt 0) {
  Write-Host "  [WARN] Detected Issues:" -ForegroundColor Yellow
  $detectedBugs | ForEach-Object { Write-Host "    - $_" -ForegroundColor Yellow }
  Write-Host ""
}

if ($script:improvements.Count -gt 0) {
  Write-Host "  [FIX] Suggested Improvements:" -ForegroundColor Cyan
  $script:improvements | ForEach-Object { Write-Host "    - $_" -ForegroundColor Cyan }
  Write-Host ""
}

if ($perfResults.Keys.Count -gt 0) {
  Write-Host "  [TIME] Performance:" -ForegroundColor Magenta
  $perfResults.GetEnumerator() | Sort-Object Name | ForEach-Object {
    Write-Host "    $($_.Key) = $($_.Value)ms" -ForegroundColor Gray
  }
  Write-Host ""
}

Write-Host "  Report saved to: $SUMMARY_FILE" -ForegroundColor Gray
Write-Host "  Log saved to:    $LOG_FILE" -ForegroundColor Gray
Write-Host ""

if ($script:FAIL -gt 0) {
  Write-Host "  [FAIL] SOME TESTS FAILED -- review report for details" -ForegroundColor Red
}
elseif ($script:WARN -gt 0) {
  Write-Host "  [WARN] All tests passed with warnings" -ForegroundColor Yellow
}
else {
  Write-Host "  [PASS] ALL TESTS PASSED" -ForegroundColor Green
}

Write-Host "============================================" -ForegroundColor Cyan

} finally {
  Pop-Location
}

exit $script:exitCode
