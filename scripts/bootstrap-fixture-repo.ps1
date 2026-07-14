# Bootstrap fixture repo for integration tests
param(
  [string]$TargetDir = "$PSScriptRoot\..\test\fixtures\repo"
)

$ErrorActionPreference = "Stop"

# Initialize git repo
if (-not (Test-Path -LiteralPath "$TargetDir\.git")) {
  git -C $TargetDir init 2>&1 | Out-Null
  git -C $TargetDir config user.email "test@malon.dev"
  git -C $TargetDir config user.name "Malon Test"
  git -C $TargetDir add -A
  git -C $TargetDir commit -m "Initial commit" 2>&1 | Out-Null
  Write-Output "Fixture repo bootstrapped at $TargetDir"
} else {
  Write-Output "Fixture repo already initialized"
}
