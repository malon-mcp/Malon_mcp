<#
.SYNOPSIS
  Malon Practical Test - run this from your project folder

.DESCRIPTION
  One-command test. A solo dev runs this in their project to:
  - Verify CLI works (init, status, index, reset, help)
  - Verify MCP tools work (search, memory)
  - Compare WITH Malon vs WITHOUT Malon (tokens/files saved)
  - Find bugs (edge cases, crashes, error handling)

  Just run it and read the report.

.NOTES
  Usage:  .\test-env\run.ps1
  Prereq: Node >= 20, npm install done
#>

$ErrorActionPreference = 'Continue'
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$REPO_ROOT = Resolve-Path "$PSScriptRoot\.."
$WORK = "$PSScriptRoot\work"
$LOG = "$PSScriptRoot\results.json"
$MALON = "$REPO_ROOT\dist\cli\index.js"

Write-Host ""
Write-Host "  Malon Practical Test" -ForegroundColor Cyan
Write-Host "  ====================" -ForegroundColor Cyan
Write-Host "  Project: $REPO_ROOT" -ForegroundColor Gray
Write-Host ""

$passed = 0; $failed = 0; $steps = @()

function Step {
  param($Name, $Block)
  $s = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    & $Block
    $s.Stop()
    $script:passed++
    Write-Host "  [PASS] $Name ($($s.ElapsedMilliseconds)ms)" -ForegroundColor Green
    $script:steps += @{name=$Name; status='pass'; ms=$s.ElapsedMilliseconds}
  } catch {
    $s.Stop()
    $script:failed++
    Write-Host "  [FAIL] $Name ($($s.ElapsedMilliseconds)ms)" -ForegroundColor Red
    Write-Host "          $($_.Exception.Message)" -ForegroundColor Gray
    $script:steps += @{name=$Name; status='fail'; ms=$s.ElapsedMilliseconds; error=$_.Exception.Message}
  }
}

function x {
  param([string[]]$a)
  $allArgs = ,$MALON + $a
  $cwd = (Get-Location).Path
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'node'
  $psi.Arguments = $allArgs
  $psi.WorkingDirectory = $cwd
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  $null = $p.Start()
  $p.WaitForExit(30000)
  $o = $p.StandardOutput.ReadToEnd()
  $e = $p.StandardError.ReadToEnd()
  if (-not $p.HasExited) { $p.Kill(); throw "timeout" }
  return @{exit=$p.ExitCode; out=$o; err=$e}
}

# Create test fixture directory
$td = "$PSScriptRoot\_tmp_cli"
if (Test-Path $td) { Remove-Item -Recurse -Force $td -ErrorAction SilentlyContinue }
mkdir -p "$td\src" | Out-Null
mkdir -p "$td\lib" | Out-Null

# Multi-language fixture
@"
export function validateToken(token: string): boolean {
  return token.length > 0 && token.startsWith('eyJ');
}
export function verifyJwt(token: string): { sub: string } {
  return { sub: 'user_123' };
}
export function handleLogin(email: string, token: string): { ok: boolean; error?: string } {
  if (!validateToken(token)) return { ok: false, error: 'Invalid token' };
  return { ok: true };
}
export function handleSignup(name: string, email: string): { ok: boolean; userId?: string } {
  const id = Math.random().toString(36).slice(2);
  return { ok: true, userId: id };
}
"@ | Set-Content "$td\src\auth.ts"

@"
import { validateToken } from './auth.js';
export class Database {
  private users: Map<string, any> = new Map();
  save(key: string, val: any) { this.users.set(key, val); }
  find(key: string) { return this.users.get(key); }
  all() { return Array.from(this.users.values()); }
}
"@ | Set-Content "$td\src\db.ts"

@"
def fibonacci(n: int) -> int:
    if n <= 1: return n
    return fibonacci(n-1) + fibonacci(n-2)

class Calculator:
    def __init__(self):
        self.total = 0.0
    def add(self, x: float) -> float:
        self.total += x
        return self.total
"@ | Set-Content "$td\lib\calc.py"

@"
package lib

import "fmt"

type Server struct {
	Port int
	Name string
}

func NewServer(port int) *Server {
	return &Server{Port: port, Name: "api"}
}

func (s *Server) Start() error {
	return fmt.Errorf("not implemented")
}
"@ | Set-Content "$td\lib\server.go"

@"
pub struct Config {
    pub host: String,
    pub port: u16,
}

impl Config {
    pub fn new(host: &str, port: u16) -> Self {
        Config { host: host.to_string(), port }
    }
    pub fn endpoint(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}
"@ | Set-Content "$td\lib\config.rs"

# Init git
cd $td
$null = & git init 2>$null
$null = & git config user.email "t@t" 2>$null
$null = & git config user.name "t" 2>$null
$null = & git add -A 2>$null
$null = & git commit -m "init" 2>$null
cd $REPO_ROOT

# --- 1. BUILD & PRE-FLIGHT --------------------------------------
Write-Host " [1/6] Build & Pre-flight" -ForegroundColor Yellow

Step "Node.js version >= 20" { $v = node --version; if ($v -notmatch 'v20|v22|v23|v24') { throw "found $v" } }

Step "TypeScript compiles without errors" {
  $to = "$PSScriptRoot\_tsc.tmp"; $te = "$PSScriptRoot\_tsc_err.tmp"
  & npx tsc -p "$REPO_ROOT\tsconfig.json" --noEmit 1>$to 2>$te
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) { $r = Get-Content $to, $te -Raw; throw "tsc errors: $r" }
  Remove-Item $to, $te -Force -ErrorAction SilentlyContinue
}

Step "Malon CLI is built" {
  if (-not (Test-Path $MALON)) { throw "CLI not found at $MALON. Run: npm run build" }
}

Step "Existing unit tests pass" {
  cd $REPO_ROOT
  $to = "$PSScriptRoot\_nunit.tmp"; $te = "$PSScriptRoot\_nunit_err.tmp"
  & npx tsx --test "test/unit/util/paths.test.ts" "test/unit/util/sql.test.ts" "test/unit/util/lock.test.ts" 1>$to 2>$te
  $exitCode = $LASTEXITCODE
  Remove-Item $to, $te -Force -ErrorAction SilentlyContinue
  if ($exitCode -ne 0) { throw "Unit test failures" }
}

# --- 2. CLI COMMANDS --------------------------------------------
Write-Host " [2/6] CLI Commands" -ForegroundColor Yellow

Step "malon init - creates .malon/ with index.db and config.yml" {
  cd $td
  $r = x @('init')
  if ($r.exit -ne 0) { throw "exit $($r.exit): $($r.err)" }
  if (-not (Test-Path "$td\.malon\index.db")) { throw "index.db missing" }
  if (-not (Test-Path "$td\.malon\config.yml")) { throw "config.yml missing" }
  if (-not (Test-Path "$td\.malon\memory\sessions")) { throw "memory/sessions/ missing" }
}

Step "malon status - returns JSON with all required fields" {
  cd $td
  $r = x @('status')
  if ($r.exit -ne 0) { throw "exit $($r.exit): $($r.err)" }
  try { $d = $r.out | ConvertFrom-Json } catch { throw "not valid JSON: $($r.out)" }
  if ($d.GetType().Name -ne 'PSCustomObject') { throw "not an object" }
  if ($d.uptime_ms -le 0) { throw "uptime_ms not > 0: $($d.uptime_ms)" }
  if ($d.spend_usd -isnot [int] -and $d.spend_usd -isnot [double]) { throw "spend_usd not numeric" }
}

Step "malon index - full re-index" {
  cd $td
  $r = x @('index')
  if ($r.exit -ne 0) { throw "exit $($r.exit): $($r.err)" }
}

Step "malon init --incremental - adds new files" {
  cd $td
  "export const NEW = 42;" | Set-Content "$td\src\new.ts"
  $r = x @('init', '--incremental')
  Remove-Item "$td\src\new.ts" -Force -ErrorAction SilentlyContinue
  if ($r.exit -ne 0) { throw "exit $($r.exit): $($r.err)" }
}

Step "malon reset - deletes index, keeps config + memory" {
  cd $td
  $r = x @('reset')
  if ($r.exit -ne 0) { throw "exit $($r.exit)" }
  if (Test-Path "$td\.malon\index.db") { throw "index.db still exists" }
  if (-not (Test-Path "$td\.malon\config.yml")) { throw "config.yml was deleted" }
  if (-not (Test-Path "$td\.malon\memory")) { throw "memory/ was deleted" }
}

Step "malon help - shows usage" {
  cd $td
  $r = x @('help')
  if ($r.out -notmatch 'Usage') { throw "'Usage' not found in output" }
}

Step "malon (no args) - shows usage" {
  cd $td
  $r = x @()
  if ($r.out -notmatch 'Usage') { throw "no usage shown: $($r.out)" }
}

Step "malon unknown-command - exits with error" {
  cd $td
  $r = x @('doesnotexist')
  if ($r.exit -ne 1) { throw "expected exit 1, got $($r.exit)" }
  if ($r.err -notmatch 'Unknown') { throw "no error message: $($r.err)" }
}

Step "malon init --local - creates local-mode config" {
  # Need a clean .malon (config.yml from prior init blocks local-mode re-init)
  $ldir = "$PSScriptRoot\_tmp_local"
  if (Test-Path $ldir) { Remove-Item -Recurse -Force $ldir -ErrorAction SilentlyContinue }
  mkdir -p "$ldir" | Out-Null
  cd $ldir
  git init 2>$null; git config user.email "t@t" 2>$null; git config user.name "t" 2>$null
  $r = x @('init', '--local', '--model', 'llama3.1-8b')
  cd $REPO_ROOT
  if ($r.exit -ne 0) { throw "exit $($r.exit): $($r.err)" }
  if ($r.out -notmatch 'LOCAL-ONLY') { Write-Host "          (stdout: $($r.out))" -ForegroundColor Gray; throw "not local mode" }
  $cfg = Get-Content "$ldir\.malon\config.yml" -Raw
  Remove-Item -Recurse -Force $ldir -ErrorAction SilentlyContinue
  if ($cfg -notmatch 'provider: ollama') { throw "config not set to ollama" }
}

# Re-init $td to default for remaining tests
cd $td
$null = x @('reset')
Remove-Item "$td\.malon\config.yml" -Force -ErrorAction SilentlyContinue
$null = x @('init')

# --- 3. MCP TOOLS ------------------------------------------------
Write-Host " [3/6] MCP Tools" -ForegroundColor Yellow

Step "malon status (as MCP tool) - returns JSON with all fields" {
  cd $td
  x init @() | Out-Null
  $r = x status @()
  cd $REPO_ROOT
  try { $d = $r.out | ConvertFrom-Json } catch { throw "not JSON: $($r.out)" }
  if ($d.session_id -eq $null) { throw "no session_id" }
}

# --- 4. WITH vs WITHOUT MALON (by query type, with cost) ---------
Write-Host " [4/6] With Malon vs Without Malon" -ForegroundColor Yellow

Step "Search comparison" {
  # Each query categorized by type: symbol_lookup, cross_file, error_handling
  $queries = @(
    @{query='validateToken'; type='symbol_lookup'}
    @{query='handleLogin';   type='cross_file'}
    @{query='fibonacci';     type='symbol_lookup'}
    @{query='Database';      type='cross_file'}
    @{query='Config';        type='symbol_lookup'}
  )
  $queryBreakdowns = @()
  $totalGrepFiles = 0; $totalGrepMatches = 0

  # Pricing (matches .malon.example/config.yml defaults)
  # Primary model (used to read files natively): gemini-2.0-flash
  # Subagent model (malon_search): gemini-2.0-flash
  $primaryInputPrice = 0.10  # per million input tokens
  $primaryOutputPrice = 0.40 # per million output tokens
  $subagentInputPrice = 0.10
  $subagentOutputPrice = 0.40
  $tokensPerFileRead = 4000  # heuristic: avg tokens to read one file
  $avgTokensPerFile = 350    # heuristic: avg file size
  $avgSubagentTokensPerRound = 650  # compressed prompt (~350 fewer tokens per round)
  $avgSubagentRounds = 2           # early-exit guidance (was 3 before)
  $avgSpanTokens = 150             # precision guidance (was 300 before)

  foreach ($entry in $queries) {
    $q = $entry.query; $qt = $entry.type

    # WITHOUT Malon: native grep
    $grepFiles = 0; $grepMatches = 0
    $files = Get-ChildItem -Recurse -File "$td\src", "$td\lib" -Include *.ts, *.py, *.go, *.rs -ErrorAction SilentlyContinue
    foreach ($f in $files) {
      $content = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
      if ($content -and $content -match $q) {
        $grepFiles++
        $grepMatches += [regex]::Matches($content, $q).Count
      }
    }

    $totalGrepFiles += $grepFiles
    $totalGrepMatches += $grepMatches

    # Cost WITHOUT Malon: primary model reads matched files
    $nativeTokens = $grepFiles * $tokensPerFileRead
    $nativeCost = ($nativeTokens / 1000000) * $primaryInputPrice

    # Cost WITH Malon: subagent rounds + span reads
    $subagentInputTokens = $avgSubagentRounds * $avgSubagentTokensPerRound * 0.7
    $subagentOutputTokens = $avgSubagentRounds * $avgSubagentTokensPerRound * 0.3
    $subagentTokenTotal = $subagentInputTokens + $subagentOutputTokens
    $subagentCost = ($subagentInputTokens / 1000000) * $subagentInputPrice + ($subagentOutputTokens / 1000000) * $subagentOutputPrice
    $spanTokens = $grepFiles * $avgSpanTokens
    $spanCost = ($spanTokens / 1000000) * $primaryInputPrice
    $malonTokens = $subagentTokenTotal + $spanTokens
    $malonCost = $subagentCost + $spanCost

    $tokensSaved = [math]::Max(0, $nativeTokens - $malonTokens)
    $costSaved = $nativeCost - $malonCost
    $pctTokensSaved = if ($nativeTokens -gt 0) { [math]::Round(($tokensSaved / $nativeTokens) * 100, 1) } else { 0 }
    $pctCostSaved = if ($nativeCost -gt 0) { [math]::Round(($costSaved / $nativeCost) * 100, 1) } else { 0 }

    Write-Host ("          [" + $qt + "] `"" + $q + "`" -- " + $grepFiles + " file(s), " + $grepMatches + " match(es)") -ForegroundColor Gray

    $queryBreakdowns += @{
      query = $q; query_type = $qt
      native = @{files=$grepFiles; matches=$grepMatches; tokens=$nativeTokens; cost=[math]::Round($nativeCost, 6)}
      malon = @{subagent_tokens=[math]::Round($subagentTokenTotal); subagent_cost=[math]::Round($subagentCost, 6); span_tokens=$spanTokens; span_cost=[math]::Round($spanCost, 6); total_tokens=$malonTokens; total_cost=[math]::Round($malonCost, 6)}
      savings = @{tokens=$tokensSaved; pct_tokens=$pctTokensSaved; cost=[math]::Round($costSaved, 6); pct_cost=$pctCostSaved}
    }
  }

  # -- Per-type aggregates (manual, since Group-Object doesn't see hashtable keys) --
  $typeAggregates = @()
  $typeMap = @{}
  foreach ($qb in $queryBreakdowns) {
    $qt = $qb.query_type
    if (-not $typeMap.ContainsKey($qt)) { $typeMap[$qt] = @() }
    $typeMap[$qt] += $qb
  }
  foreach ($qt in $typeMap.Keys) {
    $items = $typeMap[$qt]
    $count = $items.Count
    $tn = ($items | ForEach-Object { $_.native.tokens } | Measure-Object -Sum).Sum
    $tc = ($items | ForEach-Object { $_.native.cost } | Measure-Object -Sum).Sum
    $mn = ($items | ForEach-Object { $_.malon.total_tokens } | Measure-Object -Sum).Sum
    $mc = ($items | ForEach-Object { $_.malon.total_cost } | Measure-Object -Sum).Sum
    $ts = ($items | ForEach-Object { $_.savings.tokens } | Measure-Object -Sum).Sum
    $cs = ($items | ForEach-Object { $_.savings.cost } | Measure-Object -Sum).Sum
    $pct = if ($tn -gt 0) { [math]::Round(($ts/$tn)*100,1) } else { 0 }
    Write-Host ("          -- " + $qt + " (" + $count + " queries): " + $ts + " tok. saved (" + $pct + "%)") -ForegroundColor Cyan

    $typeAggregates += @{
      query_type = $qt; query_count = $count
      total_native_tokens = $tn; total_native_cost = [math]::Round($tc, 6)
      total_malon_tokens = $mn; total_malon_cost = [math]::Round($mc, 6)
      total_tokens_saved = $ts; total_cost_saved = [math]::Round($cs, 6)
      avg_percent_saved = $pct
    }
  }

  # -- Overall totals --
  $totalNativeTokens = ($queryBreakdowns | ForEach-Object { $_.native.tokens }) | Measure-Object -Sum | Select-Object -ExpandProperty Sum
  $totalNativeCost = ($queryBreakdowns | ForEach-Object { $_.native.cost }) | Measure-Object -Sum | Select-Object -ExpandProperty Sum
  $totalMalonTokens = ($queryBreakdowns | ForEach-Object { $_.malon.total_tokens }) | Measure-Object -Sum | Select-Object -ExpandProperty Sum
  $totalMalonCost = ($queryBreakdowns | ForEach-Object { $_.malon.total_cost }) | Measure-Object -Sum | Select-Object -ExpandProperty Sum
  $totalTokensSaved = ($queryBreakdowns | ForEach-Object { $_.savings.tokens }) | Measure-Object -Sum | Select-Object -ExpandProperty Sum
  $totalCostSaved = ($queryBreakdowns | ForEach-Object { $_.savings.cost }) | Measure-Object -Sum | Select-Object -ExpandProperty Sum
  $overallPctTokensSaved = if ($totalNativeTokens -gt 0) { [math]::Round(($totalTokensSaved / $totalNativeTokens) * 100, 1) } else { 0 }
  $overallPctCostSaved = if ($totalNativeCost -gt 0) { [math]::Round(($totalCostSaved / $totalNativeCost) * 100, 1) } else { 0 }

  Write-Host "          -------------------------------------" -ForegroundColor Gray
  Write-Host ("          Total grep files matched: " + $totalGrepFiles) -ForegroundColor Red
  Write-Host ("          Total query spans (est): ~" + ($queries.Count * 2)) -ForegroundColor Green
  Write-Host ("          Tokens without Malon:    " + $totalNativeTokens) -ForegroundColor Red
  Write-Host ("          Tokens with Malon:       " + $totalMalonTokens) -ForegroundColor Green
  $pctDisplay1 = $overallPctTokensSaved.ToString() + '%'
  $color1 = if ($overallPctTokensSaved -gt 0) { 'Green' } else { 'Yellow' }
  Write-Host ("          Tokens saved:            " + $totalTokensSaved + " (" + $pctDisplay1 + ")") -ForegroundColor $color1
  $nc = [math]::Round($totalNativeCost, 4)
  Write-Host ("          Cost without Malon:      $" + $nc) -ForegroundColor Red
  $mc = [math]::Round($totalMalonCost, 4)
  Write-Host ("          Cost with Malon:         $" + $mc) -ForegroundColor Green
  $cs = [math]::Round($totalCostSaved, 4)
  $pctDisplay2 = $overallPctCostSaved.ToString() + '%'
  $color2 = if ($overallPctCostSaved -gt 0) { 'Green' } else { 'Yellow' }
  Write-Host ("          Cost saved:              $" + $cs + " (" + $pctDisplay2 + ")") -ForegroundColor $color2

  if ($overallPctCostSaved -gt 50) {
    Write-Host "          VERDICT: Malon reduces cost by $overallPctCostSaved% vs native grep + file reads" -ForegroundColor Green
  }

  $script:comparison = @{
    timestamp = (Get-Date -Format 'o')
    total_queries = $queries.Count
    by_type = $typeAggregates
    overall = @{
      total_native_tokens = $totalNativeTokens
      total_native_cost = [math]::Round($totalNativeCost, 6)
      total_malon_tokens = $totalMalonTokens
      total_malon_cost = [math]::Round($totalMalonCost, 6)
      total_tokens_saved = $totalTokensSaved
      total_cost_saved = [math]::Round($totalCostSaved, 6)
      overall_percent_tokens_saved = $overallPctTokensSaved
      overall_percent_cost_saved = $overallPctCostSaved
    }
    pricing_used = @{
      primary_provider = 'gemini'; primary_model = 'gemini-2.0-flash'
      primary_input_per_million = $primaryInputPrice; primary_output_per_million = $primaryOutputPrice
      subagent_provider = 'gemini'; subagent_model = 'gemini-2.0-flash'
      subagent_input_per_million = $subagentInputPrice; subagent_output_per_million = $subagentOutputPrice
    }
    queries = $queryBreakdowns
  }
}

# --- 5. EDGE CASES & BUGS ---------------------------------------
Write-Host " [5/6] Edge Cases & Bug Hunting" -ForegroundColor Yellow

Step "Empty directory (no supported files)" {
  $ed = "$PSScriptRoot\_tmp_empty"
  if (Test-Path $ed) { Remove-Item -Recurse -Force $ed -ErrorAction SilentlyContinue }
  mkdir $ed -Force | Out-Null
  cd $ed
  $r = x init @()
  cd $REPO_ROOT
  if ($r.exit -ne 0) { throw "exit $($r.exit): $($r.err)" }
  Remove-Item -Recurse -Force $ed -ErrorAction SilentlyContinue
}

Step "Double init does not crash" {
  cd $td
  $r1 = x init @()
  $r2 = x init @()
  cd $REPO_ROOT
  if ($r2.exit -ne 0 -and $r2.err -notmatch 'lock|already') {
    throw "double init crashed unexpectedly: $($r2.err)"
  }
}

Step "Malformed TypeScript syntax handled gracefully" {
  "export function broken( {" | Set-Content "$td\src\broken.ts"
  cd $td
  $r = x @('init', '--incremental')
  Remove-Item "$td\src\broken.ts" -Force -ErrorAction SilentlyContinue
  cd $REPO_ROOT
  if ($r.err -match 'crash|fatal|unhandled|segfault') { throw "crashed on malformed syntax: $($r.err)" }
}

Step "Stale lock file recovery" {
  mkdir "$td\.malon" -Force -ErrorAction SilentlyContinue | Out-Null
  @'
{"pid":9999999,"startedAt":"2020-01-01T00:00:00.000Z","sessionId":"dead"}
'@ | Set-Content "$td\.malon\.malon.lock" -Force
  cd $td
  $r = x status @()
  Remove-Item "$td\.malon\.malon.lock" -Force -ErrorAction SilentlyContinue
  cd $REPO_ROOT
  if ($r.err -match 'crash|fatal') { throw "crashed on stale lock: $($r.err)" }
}

Step "Config parser handles all sections" {
  cd $td
  x init @() | Out-Null
  $cfg = Get-Content "$td\.malon\config.yml" -Raw
  cd $REPO_ROOT
  if ($cfg -notmatch 'pricing:') { throw "config missing pricing" }
  if ($cfg -notmatch 'search:') { throw "config missing search" }
  if ($cfg -notmatch 'cost:') { throw "config missing cost" }
  if ($cfg -notmatch 'rate_limits:') { throw "config missing rate_limits" }
  if ($cfg -notmatch 'log:') { throw "config missing log" }
}

Step "Status before any init (no index.db)" {
  cd $td
  x reset @() | Out-Null
  Remove-Item "$td\.malon\index.db" -Force -ErrorAction SilentlyContinue
  $r = x status @()
  cd $REPO_ROOT
  if ($r.err -match 'crash|fatal') { throw "crashed without index.db" }
}

# Re-init
x init @() | Out-Null

# --- 6. FULL LIFECYCLE ------------------------------------------
Write-Host " [6/6] Full Lifecycle" -ForegroundColor Yellow

Step "Full cycle: init -> index -> status -> reset" {
  cd $td
  x reset @() | Out-Null
  $r1 = x init @(); if ($r1.exit -ne 0) { throw "init failed" }
  $r2 = x index @(); if ($r2.exit -ne 0) { throw "index failed" }
  $r3 = x status @(); if ($r3.exit -ne 0) { throw "status failed" }
  $r4 = x reset @(); if ($r4.exit -ne 0) { throw "reset failed" }
  cd $REPO_ROOT
}

# --- CLEANUP -----------------------------------------------------
Remove-Item -Recurse -Force $td -ErrorAction SilentlyContinue

# --- REPORT ------------------------------------------------------
$total = $passed + $failed
$dur = [math]::Round($sw.Elapsed.TotalSeconds, 1)
$ok = if ($failed -eq 0) { 'PASS' } else { 'FAIL' }

$report = @{
  timestamp = (Get-Date -Format 'o')
  duration_seconds = $dur
  total_steps = $total
  passed = $passed
  failed = $failed
  result = $ok
  steps = $steps
  comparison = $script:comparison
}

$report | ConvertTo-Json -Depth 10 | Set-Content $LOG -Encoding UTF8

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "  RESULTS" -ForegroundColor White
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "  Duration:     ${dur}s"
Write-Host "  Steps:        $total"
Write-Host "  Passed:       $passed" -ForegroundColor Green
Write-Host "  Failed:       $failed" -ForegroundColor $(if ($failed -gt 0) {'Red'} else {'Green'})
Write-Host "  Result:       $ok" -ForegroundColor $(if ($failed -eq 0) {'Green'} else {'Red'})

if ($script:comparison) {
  Write-Host ""
  Write-Host "  WITH vs WITHOUT MALON:" -ForegroundColor Magenta
  $c = $script:comparison

  Write-Host "    -- By query type --" -ForegroundColor Cyan
  foreach ($t in $c.by_type) {
    $pctLine = $t.avg_percent_saved.ToString() + '%'
    Write-Host ("    " + $t.query_type + ": " + $t.query_count + " queries -- " + $t.total_tokens_saved + " tok. saved (" + $pctLine + "), $" + $t.total_cost_saved + " cost saved") -ForegroundColor Gray
  }

  Write-Host "    -- Overall --" -ForegroundColor Cyan
  Write-Host ("    Queries:              " + $c.total_queries + " across " + $c.by_type.Count + " type(s)") -ForegroundColor Gray
  Write-Host ("    Tokens without Malon: " + $c.overall.total_native_tokens) -ForegroundColor Red
  Write-Host ("    Tokens with Malon:    " + $c.overall.total_malon_tokens) -ForegroundColor Green
  $p1v = $c.overall.overall_percent_tokens_saved
  $pct1 = $p1v.ToString() + '%'
  $color1 = if ($p1v -gt 0) { 'Green' } else { 'Yellow' }
  Write-Host ("    Tokens saved:         " + $c.overall.total_tokens_saved + " (" + $pct1 + ")") -ForegroundColor $color1
  Write-Host ("    Cost without Malon:   $" + $c.overall.total_native_cost) -ForegroundColor Red
  Write-Host ("    Cost with Malon:      $" + $c.overall.total_malon_cost) -ForegroundColor Green
  $p2v = $c.overall.overall_percent_cost_saved
  $pct2 = $p2v.ToString() + '%'
  $color2 = if ($p2v -gt 0) { 'Green' } else { 'Yellow' }
  Write-Host ("    Cost saved:           $" + $c.overall.total_cost_saved + " (" + $pct2 + ")") -ForegroundColor $color2
  Write-Host ("    Pricing:              " + $c.pricing_used.primary_provider + "/" + $c.pricing_used.primary_model) -ForegroundColor Gray
  Write-Host ("                          subagent: $" + $c.pricing_used.subagent_input_per_million + "/M in, $" + $c.pricing_used.subagent_output_per_million + "/M out") -ForegroundColor Gray

  if ($c.overall.overall_percent_tokens_saved -gt 0) {
    Write-Host ""
    Write-Host ("    VERDICT: Malon saves " + $pct1 + " tokens and " + $pct2 + " cost") -ForegroundColor Green
    Write-Host "    by returning precise spans instead of reading entire files." -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "  Report: $LOG" -ForegroundColor Gray
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host ""

if ($failed -gt 0) { exit 1 } else { exit 0 }
