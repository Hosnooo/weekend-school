# Fast, repeatable local verification against an ALREADY PREPARED local stack.
# No dependency installation, database reset, GitHub Actions, or deployment.
[CmdletBinding()]
param(
  [ValidateSet('Unit', 'Quality', 'Database', 'Smoke', 'Browser', 'All')]
  [string]$Mode = 'Smoke',
  [switch]$ResetLocalFixtures
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

function Invoke-Pnpm {
  param([string[]]$Arguments)
  Write-Host ("pnpm " + ($Arguments -join ' ')) -ForegroundColor Cyan
  & pnpm @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "pnpm $($Arguments[0]) failed with exit code $LASTEXITCODE."
  }
}

function Assert-LocalSupabase {
  $statusLines = & pnpm exec supabase status -o env
  if ($LASTEXITCODE -ne 0) {
    throw 'Local Supabase is not running. Start Docker and run pnpm db:start.'
  }

  $values = @{}
  foreach ($line in @($statusLines)) {
    if ($line -match '^([A-Z_]+)=(.*)$') {
      $values[$Matches[1]] = $Matches[2].Trim('"')
    }
  }

  foreach ($required in @('DB_URL', 'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY')) {
    if (-not $values.ContainsKey($required)) {
      throw "Supabase did not return $required. Run pnpm db:status to diagnose."
    }
  }

  if ($values['DB_URL'] -notmatch '^postgres(?:ql)?://[^\s]+@(127\.0\.0\.1|localhost):\d+/') {
    throw 'Refusing to test against a non-local PostgreSQL database.'
  }
  if ($values['API_URL'] -notmatch '^http://(127\.0\.0\.1|localhost):\d+$') {
    throw 'Refusing to test against a non-local Supabase API.'
  }

  $env:NEXT_PUBLIC_SUPABASE_URL = $values['API_URL']
  $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $values['ANON_KEY']
  $env:SUPABASE_SERVICE_ROLE_KEY = $values['SERVICE_ROLE_KEY']
  $env:E2E_BASE_URL = 'http://127.0.0.1:3000'
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw 'pnpm not found. Enable Corepack and install dependencies once.'
}

$needsDatabase = $Mode -in @('Database', 'Smoke', 'Browser', 'All')
$needsBrowser = $Mode -in @('Smoke', 'Browser', 'All')
if ($needsDatabase) {
  Assert-LocalSupabase
}
if ($ResetLocalFixtures) {
  if (-not $needsDatabase) {
    throw 'ResetLocalFixtures applies only to Database, Smoke, Browser or All modes.'
  }
  Write-Warning 'Resetting the disposable LOCAL Webapp database. All existing LOCAL records will be lost.'
  Invoke-Pnpm @('db:reset')
  if ($needsBrowser) {
    & docker cp 'supabase/seed.e2e.sql' 'supabase_db_Webapp:/tmp/seed.e2e.sql'
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy local E2E fixtures into Docker.' }
    & docker exec supabase_db_Webapp psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed.e2e.sql
    if ($LASTEXITCODE -ne 0) { throw 'Loading local E2E fixtures failed.' }
  }
}
if ($needsBrowser) {
  if (-not (Test-Path -LiteralPath '.env.local')) {
    throw 'Missing .env.local. Run scripts/start-local.ps1 to configure local environment.'
  }
  $localEnvFile = Get-Content -LiteralPath '.env.local' -Raw
  if ($localEnvFile -notmatch '(?m)^NEXT_PUBLIC_SUPABASE_URL=http://(127\.0\.0\.1|localhost):\d+\s*
  $env:E2E_FAIL_FAST = 'true'
}

switch ($Mode) {
  'Unit' {
    Invoke-Pnpm @('test')
  }
  'Quality' {
    Invoke-Pnpm @('lint')
    Invoke-Pnpm @('typecheck')
    Invoke-Pnpm @('test')
    Invoke-Pnpm @('build')
  }
  'Database' {
    Invoke-Pnpm @('test:db')
  }
  'Smoke' {
    Invoke-Pnpm @(
      'test:e2e',
      'tests/e2e/admin-teaching-report-ui.spec.ts',
      'tests/e2e/arabic-flow.spec.ts',
      'tests/e2e/english-flow.spec.ts',
      'tests/e2e/report-cycle-workflow.spec.ts'
    )
  }
  'Browser' {
    Invoke-Pnpm @('test:e2e')
  }
  'All' {
    Invoke-Pnpm @('lint')
    Invoke-Pnpm @('typecheck')
    Invoke-Pnpm @('test')
    Invoke-Pnpm @('build')
    Invoke-Pnpm @('test:db')
    Invoke-Pnpm @('test:e2e')
  }
}
Write-Host "Local $Mode checks passed." -ForegroundColor Green
) {
    throw '.env.local must point at local Supabase. Run scripts/start-local.ps1; never run E2E against production.'
  }
  # If an existing Next dev server was launched with different variables,
  # restart it after correcting .env.local before reusing its port.
  # Avoid CI mode: keep local server reuse and readable list output.
  $env:E2E_FAIL_FAST = 'true'
}

switch ($Mode) {
  'Unit' {
    Invoke-Pnpm @('test')
  }
  'Quality' {
    Invoke-Pnpm @('lint')
    Invoke-Pnpm @('typecheck')
    Invoke-Pnpm @('test')
    Invoke-Pnpm @('build')
  }
  'Database' {
    Invoke-Pnpm @('test:db')
  }
  'Smoke' {
    Invoke-Pnpm @(
      'test:e2e',
      'tests/e2e/admin-teaching-report-ui.spec.ts',
      'tests/e2e/arabic-flow.spec.ts',
      'tests/e2e/english-flow.spec.ts',
      'tests/e2e/report-cycle-workflow.spec.ts'
    )
  }
  'Browser' {
    Invoke-Pnpm @('test:e2e')
  }
  'All' {
    Invoke-Pnpm @('lint')
    Invoke-Pnpm @('typecheck')
    Invoke-Pnpm @('test')
    Invoke-Pnpm @('build')
    Invoke-Pnpm @('test:db')
    Invoke-Pnpm @('test:e2e')
  }
}
Write-Host "Local $Mode checks passed." -ForegroundColor Green
