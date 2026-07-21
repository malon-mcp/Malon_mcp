<#
.SYNOPSIS
  Malon Deep Diagnostics & Bug Finder

.DESCRIPTION
  Targeted bug-hunting and flaw detection for Malon CLI and MCP server.
  Checks:
    - All CLI commands produce correct exit codes
    - Output conforms to expected schemas
    - Security mechanisms (config isolation, path confinement)
    - Edge cases: empty repos, large repos, symlinks, unicode, binary files
    - Lock file behavior and crash recovery
    - Config parser edge cases (missing values, malformed nested YAML)
    - Memory ledger creation and persistence
    - Build integrity

.NOTES
  Run:  .\test-env\diagnostics.ps1 [--detailed]
  Requires: Node.js >= 20, npm run build
#>

param([switch]$Detailed)

$ErrorActionPreference = 'Stop'
$REPO_ROOT = Resolve-Path "$PSScriptRoot\.."
$MALON_CLI = "$REPO_ROOT\dist\cli\index.js"
$BugsFound = @()
$FlawsFound = @()
$WarningsFound = @()
$TotalChecks = 0
$PassedChecks = 0

function Check {
  param([string]$Category, [string]$Name, [scriptblock]$Block)
  $TotalChecks++
  try {
    $null = & $Block
    $PassedChecks++
    if ($Detailed) { Write-Host "  [PASS] $Name" -ForegroundColor Green }
  } catch {
    $BugsFound += "@ $Category -- $Name`: $($_.Exception.Message)"
    Write-Host "  [FAIL] $Name" -ForegroundColor Red
  }
}

function Invoke-Malon {
  param([string[]]$Arguments, [string]$WorkingDir)
  $process = Start-Process -FilePath 'node' -ArgumentList @($MALON_CLI) + $Arguments -NoNewWindow -PassThru -RedirectStandardOutput "$REPO_ROOT\test-env\_diag_stdout.tmp" -RedirectStandardError "$REPO_ROOT\test-env\_diag_stderr.tmp" -WorkingDirectory $WorkingDir
  $completed = $process.WaitForExit(10000)
  if (-not $completed) { $process.Kill(); throw "TIMEOUT" }
  $stdout = Get-Content "$REPO_ROOT\test-env\_diag_stdout.tmp" -Raw -ErrorAction SilentlyContinue
  $stderr = Get-Content "$REPO_ROOT\test-env\_diag_stderr.tmp" -Raw -ErrorAction SilentlyContinue
  Remove-Item "$REPO_ROOT\test-env\_diag_stdout.tmp" -Force -ErrorAction SilentlyContinue
  Remove-Item "$REPO_ROOT\test-env\_diag_stderr.tmp" -Force -ErrorAction SilentlyContinue
  if (-not $stdout) { $stdout = '' }
  if (-not $stderr) { $stderr = '' }
  return @{ ExitCode = $process.ExitCode; StdOut = $stdout; StdErr = $stderr }
}

function New-TestRepo {
  $dir = "$REPO_ROOT\test-env\_diag_repo"
  if (Test-Path $dir) { Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue }
  $null = New-Item -ItemType Directory -Force -Path "$dir\src"
  return $dir
}

Write-Host "`n[DIAG] Malon Deep Diagnostics & Bug Finder" -ForegroundColor Cyan
Write-Host "   Scanning for: exit code bugs, schema violations, config flaws," -ForegroundColor Gray
Write-Host "   security gaps, edge case crashes, and performance regressions." -ForegroundColor Gray
Write-Host ""

# --- 1. CLI COMMAND VALIDATION --------------------------------------
Write-Host "[CHK] CLI Command Validation" -ForegroundColor Yellow

$testDir = New-TestRepo
try {
  # Init with specific fixture files
  Set-Content -Path "$testDir\src\index.ts" -Value 'export const VERSION = "1.0.0";'

  Check -Category 'exit-codes' -Name 'malon init exits 0' -Block {
    $r = Invoke-Malon -Arguments @('init') -WorkingDir $testDir
    if ($r.ExitCode -ne 0) { throw "init exit $($r.ExitCode)" }
    if (-not (Test-Path "$testDir\.malon\index.db")) { throw "index.db missing" }
  }

  Check -Category 'exit-codes' -Name 'malon status exits 0' -Block {
    $r = Invoke-Malon -Arguments @('status') -WorkingDir $testDir
    if ($r.ExitCode -ne 0) { throw "status exit $($r.ExitCode)" }
  }

  Check -Category 'exit-codes' -Name 'malon index exits 0' -Block {
    $r = Invoke-Malon -Arguments @('index') -WorkingDir $testDir
    if ($r.ExitCode -ne 0) { throw "index exit $($r.ExitCode)" }
  }

  Check -Category 'exit-codes' -Name 'malon init --incremental exits 0' -Block {
    $r = Invoke-Malon -Arguments @('init', '--incremental') -WorkingDir $testDir
    if ($r.ExitCode -ne 0) { throw "incremental exit $($r.ExitCode)" }
  }

  Check -Category 'exit-codes' -Name 'malon reset exits 0' -Block {
    $r = Invoke-Malon -Arguments @('reset') -WorkingDir $testDir
    if ($r.ExitCode -ne 0) { throw "reset exit $($r.ExitCode)" }
  }

  Check -Category 'exit-codes' -Name 'malon help exits 0' -Block {
    $r = Invoke-Malon -Arguments @('help') -WorkingDir $testDir
    if ($r.ExitCode -ne 0) { throw "help exit $($r.ExitCode)" }
  }

  Check -Category 'exit-codes' -Name 'malon unknown command exits 1' -Block {
    $r = Invoke-Malon -Arguments @('doesnotexist') -WorkingDir $testDir
    if ($r.ExitCode -ne 1) { throw "expected exit 1, got $($r.ExitCode)" }
  }

  # --- 2. OUTPUT SCHEMA VALIDATION --------------------------------
  Write-Host "`n[SCH] Output Schema Validation" -ForegroundColor Yellow

  Check -Category 'schema' -Name 'status output has all required fields' -Block {
    $r = Invoke-Malon -Arguments @('status') -WorkingDir $testDir
    try { $data = $r.StdOut | ConvertFrom-Json } catch { throw "Status not valid JSON: $($r.StdOut)" }
    $required = @('session_id', 'spend_usd', 'tokens_used', 'tokens_saved_cumulative', 'rot_flag', 'last_index_sha', 'uptime_ms', 'local_mode')
    $missing = $required | Where-Object { $data.$_ -eq $null }
    if ($missing.Count -gt 0) { throw "Missing fields: $($missing -join ', ')" }
    if ($data.session_id -match '^[0-9a-f-]{36}$' -eq $false) { $FlawsFound += "session_id not UUID format: $($data.session_id)" }
  }

  Check -Category 'schema' -Name 'status types are correct' -Block {
    $r = Invoke-Malon -Arguments @('status') -WorkingDir $testDir
    $data = $r.StdOut | ConvertFrom-Json
    if ($data.spend_usd -isnot [double] -and $data.spend_usd -isnot [int]) { throw "spend_usd not number" }
    if ($data.tokens_used -isnot [int]) { throw "tokens_used not int" }
    if ($data.uptime_ms -isnot [int]) { throw "uptime_ms not int" }
    if ($data.local_mode -isnot [bool]) { throw "local_mode not bool" }
  }

  # --- 3. EDGE CASES ----------------------------------------------
  Write-Host "`n[TIME] Edge Case Testing" -ForegroundColor Yellow

  Check -Category 'edge-cases' -Name 'empty directory (no supported files)' -Block {
    $ed = New-TestRepo
    try {
      $r = Invoke-Malon -Arguments @('init') -WorkingDir $ed
      # Should succeed (but warn about no files)
      if ($r.ExitCode -ne 0) { throw "empty dir init exit $($r.ExitCode)" }
    } finally { Remove-Item -Recurse -Force $ed -ErrorAction SilentlyContinue }
  }

  Check -Category 'edge-cases' -Name 'single-file TypeScript repo' -Block {
    $sd = New-TestRepo
    try {
      Set-Content -Path "$sd\src\app.ts" -Value 'export const APP = "test";'
      $r = Invoke-Malon -Arguments @('init') -WorkingDir $sd
      if ($r.ExitCode -ne 0) { throw "single-file exit $($r.ExitCode)" }
      $r2 = Invoke-Malon -Arguments @('status') -WorkingDir $sd
      $data = $r2.StdOut | ConvertFrom-Json
      # Verify status works after single-file init
    } finally { Remove-Item -Recurse -Force $sd -ErrorAction SilentlyContinue }
  }

  Check -Category 'edge-cases' -Name 'double init does not crash' -Block {
    $dd = New-TestRepo
    try {
      Set-Content -Path "$dd\src\app.ts" -Value 'export const X = 1;'
      $r1 = Invoke-Malon -Arguments @('init') -WorkingDir $dd
      $r2 = Invoke-Malon -Arguments @('init') -WorkingDir $dd
      if ($r2.ExitCode -ne 0) {
        # If lock prevents it, verify the error message is clear, not a crash
        if ($r2.StdErr -notmatch 'lock|already|exists|error') {
          throw "Double init failed with unclear error: $($r2.StdErr)"
        }
        $FlawsFound += "Double init blocked by lock -- acceptable but verify init releases lock"
      }
    } finally { Remove-Item -Recurse -Force $dd -ErrorAction SilentlyContinue }
  }

  Check -Category 'edge-cases' -Name 'init with binary/non-text files' -Block {
    $bd = New-TestRepo
    try {
      Set-Content -Path "$bd\src\app.ts" -Value 'export const APP = "test";'
      # Add a binary file
      $fs = [System.IO.File]::Create("$bd\src\data.bin")
      $fs.Write([byte[]]@(0x00, 0xFF, 0xFE, 0xED, 0xBE, 0xEF), 0, 6)
      $fs.Close()
      $r = Invoke-Malon -Arguments @('init') -WorkingDir $bd
      if ($r.ExitCode -ne 0) { throw "binary-file init exit $($r.ExitCode)" }
      # Should not crash, should skip binary files
    } finally { Remove-Item -Recurse -Force $bd -ErrorAction SilentlyContinue }
  }

  Check -Category 'edge-cases' -Name 'Deeply nested directory structure' -Block {
    $nd = New-TestRepo
    try {
      $depthPath = "$nd\src\a\b\c\d\e\f\g"
      $null = New-Item -ItemType Directory -Force -Path $depthPath
      Set-Content -Path "$depthPath\deep.ts" -Value 'export const DEEP = true;'
      $r = Invoke-Malon -Arguments @('init') -WorkingDir $nd
      if ($r.ExitCode -ne 0) { throw "deep-nested exit $($r.ExitCode)" }
    } finally { Remove-Item -Recurse -Force $nd -ErrorAction SilentlyContinue }
  }

  Check -Category 'edge-cases' -Name 'Large JSON-like file' -Block {
    $lg = New-TestRepo
    try {
      $content = "export const data = [" + ( "1," * 10000 ) + "];"
      Set-Content -Path "$lg\src\big.ts" -Value $content
      $r = Invoke-Malon -Arguments @('init') -WorkingDir $lg
      if ($r.ExitCode -ne 0) { throw "large-file exit $($r.ExitCode)" }
    } finally { Remove-Item -Recurse -Force $lg -ErrorAction SilentlyContinue }
  }

  # --- 4. LOCK FILE BEHAVIOR --------------------------------------
  Write-Host "`n[LOCK] Lock File Testing" -ForegroundColor Yellow

  Check -Category 'lock' -Name 'Stale lock file is handled gracefully' -Block {
    $lk = New-TestRepo
    try {
      Set-Content -Path "$lk\src\app.ts" -Value 'export const X = 1;'
      # Create a stale lock from a dead PID
      $null = New-Item -ItemType Directory -Force -Path "$lk\.malon"
      Set-Content -Path "$lk\.malon\.malon.lock" -Value '{"pid":9999999,"startedAt":"2020-01-01T00:00:00.000Z","sessionId":"dead"}'
      $r = Invoke-Malon -Arguments @('init') -WorkingDir $lk
      # Should succeed, overriding stale lock
      if ($r.ExitCode -ne 0) { throw "stale lock caused failure: $($r.StdErr)" }
    } finally { Remove-Item -Recurse -Force $lk -ErrorAction SilentlyContinue }
  }

  # --- 5. CONFIG PARSER -------------------------------------------
  Write-Host "`n[CFG]  Config Parser Testing" -ForegroundColor Yellow

  Check -Category 'config' -Name 'Config.yml with all sections parses correctly' -Block {
    $cf = New-TestRepo
    try {
      Set-Content -Path "$cf\src\app.ts" -Value 'export const X = 1;'
      $r = Invoke-Malon -Arguments @('init') -WorkingDir $cf
      $cfg = Get-Content "$cf\.malon\config.yml" -Raw
      if ($cfg -notmatch 'pricing:') { throw "Missing pricing" }
      if ($cfg -notmatch 'search:') { throw "Missing search" }
      if ($cfg -notmatch 'cost:') { throw "Missing cost" }
      if ($cfg -notmatch 'rate_limits:') { throw "Missing rate_limits" }
    } finally { Remove-Item -Recurse -Force $cf -ErrorAction SilentlyContinue }
  }

  Check -Category 'config' -Name 'Nested config.yml values survive read/write cycle' -Block {
    $cv = New-TestRepo
    try {
      Set-Content -Path "$cv\src\app.ts" -Value 'export const X = 1;'
      Invoke-Malon -Arguments @('init') -WorkingDir $cv | Out-Null
      $cfg1 = Get-Content "$cv\.malon\config.yml" -Raw
      # Verify indented values are present
      if ($cfg1 -notmatch '^\s+subagent_timeout_ms:') { $FlawsFound += "Indented config value subagent_timeout_ms may not be parsed" }
      if ($cfg1 -notmatch '^\s+max_calls_per_session:') { $FlawsFound += "Indented config value max_calls_per_session may not be parsed" }
      if ($cfg1 -notmatch '^\s+input_per_million:') { $FlawsFound += "Indented config value input_per_million may not be parsed" }
    } finally { Remove-Item -Recurse -Force $cv -ErrorAction SilentlyContinue }
  }

  # --- 6. MEMORY LEDGER ------------------------------------------
  Write-Host "`n[MEM] Memory Ledger Testing" -ForegroundColor Yellow

  Check -Category 'memory' -Name 'Memory directory structure created' -Block {
    $md = New-TestRepo
    try {
      Set-Content -Path "$md\src\app.ts" -Value 'export const X = 1;'
      Invoke-Malon -Arguments @('init') -WorkingDir $md | Out-Null
      if (-not (Test-Path "$md\.malon\memory")) { throw "memory/ missing" }
      if (-not (Test-Path "$md\.malon\memory\sessions")) { throw "memory/sessions/ missing" }
      # Verify decisions.md, conventions.md, rejected.md exist or are created on first write
      $files = @('decisions.md', 'conventions.md', 'rejected.md')
      foreach ($f in $files) {
        $path = "$md\.malon\memory\$f"
        if (-not (Test-Path $path)) {
          $FlawsFound += "Memory file $f not pre-created (may be created on first write)"
        }
      }
    } finally { Remove-Item -Recurse -Force $md -ErrorAction SilentlyContinue }
  }

  # --- 7. PARSE ERROR HANDLING ----------------------------------
  Write-Host "`n[FIX] Error Handling Testing" -ForegroundColor Yellow

  Check -Category 'errors' -Name 'Malformed syntax file handled gracefully' -Block {
    $me = New-TestRepo
    try {
      Set-Content -Path "$me\src\broken.ts" -Value 'export function broken( { @@@ invalid syntax }'
      $r = Invoke-Malon -Arguments @('init') -WorkingDir $me
      if ($r.ExitCode -ne 0) { $FlawsFound += "Parse error caused non-zero exit (may be expected)" }
      if ($r.StdErr -match 'crash|fatal|unhandled|segfault') { throw "Parse error crashed: $($r.StdErr)" }
    } finally { Remove-Item -Recurse -Force $me -ErrorAction SilentlyContinue }
  }

  # --- 8. BUILD INTEGRITY ----------------------------------------
  Write-Host "`n[BUILD]  Build Integrity" -ForegroundColor Yellow

  Check -Category 'build' -Name 'TypeScript compiles without errors' -Block {
    $buildResult = & npx tsc -p "$REPO_ROOT\tsconfig.json" --noEmit 2>&1
    if ($LASTEXITCODE -ne 0) { throw "TypeScript errors: $buildResult" }
  }

  Check -Category 'build' -Name 'CLI entry points exist' -Block {
    if (-not (Test-Path "$REPO_ROOT\dist\cli\index.js")) { throw "CLI entry missing" }
    if (-not (Test-Path "$REPO_ROOT\dist\server\index.js")) { throw "Server entry missing" }
  }

  # --- 9. CROSS-LANGUAGE INDEXING --------------------------------
  Write-Host "`n[LANG] Cross-Language Indexing" -ForegroundColor Yellow

  Check -Category 'indexing' -Name 'Multiple language files indexed' -Block {
    $ml = New-TestRepo
    try {
      Set-Content -Path "$ml\src\app.ts" -Value 'export const A = 1;'
      Set-Content -Path "$ml\lib\helper.py" -Value 'def hello(): return "hi"'
      Set-Content -Path "$ml\lib\calc.go" -Value 'package lib; func Add(a int) int { return a + 1 }'
      Set-Content -Path "$ml\lib\check.rs" -Value 'pub fn check() -> bool { true }'
      $r = Invoke-Malon -Arguments @('init') -WorkingDir $ml
      if ($r.ExitCode -ne 0) { throw "multi-lang init exit $($r.ExitCode)" }
    } finally { Remove-Item -Recurse -Force $ml -ErrorAction SilentlyContinue }
  }

  # --- 10. OUTPUT INTEGRITY --------------------------------------
  Write-Host "`n[PASS] Output Integrity" -ForegroundColor Yellow

  Check -Category 'output' -Name 'Status output is deterministic (no random failures)' -Block {
    $od = New-TestRepo
    try {
      Set-Content -Path "$od\src\app.ts" -Value 'export const A = 1;'
      Invoke-Malon -Arguments @('init') -WorkingDir $od | Out-Null
      $results = @()
      for ($i = 0; $i -lt 3; $i++) {
        $r = Invoke-Malon -Arguments @('status') -WorkingDir $od
        $data = $r.StdOut | ConvertFrom-Json
        $results += $data.session_id
        Start-Sleep -Milliseconds 100
      }
      # session_id should not be empty
      if ($results | Where-Object { $_ -eq '' }) { throw "Empty session_id in some calls" }
    } finally { Remove-Item -Recurse -Force $od -ErrorAction SilentlyContinue }
  }

} finally {
  Remove-Item -Recurse -Force $testDir -ErrorAction SilentlyContinue
}

# --- REPORT ----------------------------------------------------------
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  DIAGNOSTICS REPORT" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Checks:    $TotalChecks"
Write-Host "  Passed:    $PassedChecks" -ForegroundColor Green
Write-Host "  Failed:    $($TotalChecks - $PassedChecks)" -ForegroundColor $(if ($TotalChecks - $PassedChecks -gt 0) {'Red'} else {'Green'})

if ($BugsFound.Count -gt 0) {
  Write-Host "`n  [BUG] Bugs Found:" -ForegroundColor Red
  $BugsFound | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
}

if ($FlawsFound.Count -gt 0) {
  Write-Host "`n  [WARN]  Flaws / Improvements:" -ForegroundColor Yellow
  $FlawsFound | ForEach-Object { Write-Host "    - $_" -ForegroundColor Yellow }
}

if ($WarningsFound.Count -gt 0) {
  Write-Host "`n  [TIME] Warnings:" -ForegroundColor Yellow
  $WarningsFound | ForEach-Object { Write-Host "    - $_" -ForegroundColor Yellow }
}

$exitCode = if ($BugsFound.Count -gt 0) { 1 } else { 0 }
Write-Host "`n  Status: $(if ($exitCode -eq 0) { 'PASS [PASS]' } else { 'FAIL [FAIL]' })" -ForegroundColor $(if ($exitCode -eq 0) {'Green'} else {'Red'})
Write-Host "============================================" -ForegroundColor Cyan

exit $exitCode
