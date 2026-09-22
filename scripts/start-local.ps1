[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$appUrl = 'http://127.0.0.1:3000/en/login'

function Initialize-ToolchainPath {
  if ((Get-Command node -ErrorAction SilentlyContinue) -and
      (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    return
  }

  $runtimeRoot = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
  [string[]]$toolDirectories = @(
    (Join-Path $env:ProgramFiles 'nodejs'),
    (Join-Path $env:LOCALAPPDATA 'Programs\nodejs'),
    (Join-Path $runtimeRoot 'node\bin'),
    (Join-Path $runtimeRoot 'bin\fallback')
  ) | Where-Object { Test-Path -LiteralPath $_ }

  if ($toolDirectories.Count -gt 0) {
    $env:Path = (($toolDirectories + $env:Path) -join [IO.Path]::PathSeparator)
  }
}

function Repair-EnvironmentEncoding {
  $environmentPath = Join-Path $projectRoot '.env.local'
  if (-not (Test-Path -LiteralPath $environmentPath)) {
    return
  }

  [byte[]]$bytes = [System.IO.File]::ReadAllBytes($environmentPath)
  if ($bytes.Length -ge 3 -and
      $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    [byte[]]$withoutBom = if ($bytes.Length -eq 3) {
      [byte[]]::new(0)
    }
    else {
      $bytes[3..($bytes.Length - 1)]
    }
    [System.IO.File]::WriteAllBytes($environmentPath, $withoutBom)
  }
}

function Test-DockerReady {
  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & docker info *> $null
    return $LASTEXITCODE -eq 0
  }
  catch {
    return $false
  }
  finally {
    $ErrorActionPreference = $previousPreference
  }
}

function Test-LocalPort {
  param([int]$Port)

  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connection = $client.ConnectAsync('127.0.0.1', $Port)
    return $connection.Wait(500) -and $client.Connected
  }
  catch {
    return $false
  }
  finally {
    $client.Dispose()
  }
}

function Wait-ForCondition {
  param(
    [scriptblock]$Condition,
    [int]$TimeoutSeconds,
    [string]$Description
  )

  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (& $Condition) {
      return
    }
    Start-Sleep -Seconds 2
  }

  throw "Timed out waiting for $Description."
}

function Set-LocalEnvironment {
  param([string[]]$StatusLines)

  $sourceToTarget = @{
    API_URL = 'NEXT_PUBLIC_SUPABASE_URL'
    ANON_KEY = 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    SERVICE_ROLE_KEY = 'SUPABASE_SERVICE_ROLE_KEY'
  }
  $values = @{}

  foreach ($line in $StatusLines) {
    if ($line -match '^([A-Z_]+)=(.*)$' -and $sourceToTarget.ContainsKey($Matches[1])) {
      $values[$sourceToTarget[$Matches[1]]] = $Matches[2].Trim('"')
    }
  }

  foreach ($required in $sourceToTarget.Values) {
    if (-not $values.ContainsKey($required)) {
      throw "Supabase status did not return $required."
    }
  }

  $environmentPath = Join-Path $projectRoot '.env.local'
  $lines = [System.Collections.Generic.List[string]]::new()
  if (Test-Path -LiteralPath $environmentPath) {
    foreach ($existingLine in @(Get-Content -LiteralPath $environmentPath)) {
      $lines.Add([string]$existingLine)
    }
  }

  foreach ($key in $values.Keys) {
    $replacement = "$key=$($values[$key])"
    $index = -1
    for ($position = 0; $position -lt $lines.Count; $position++) {
      if ($lines[$position] -match "^$([regex]::Escape($key))=") {
        $index = $position
        break
      }
    }

    if ($index -ge 0) {
      $lines[$index] = $replacement
    }
    else {
      $lines.Add($replacement)
    }
  }

  $utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllLines($environmentPath, [string[]]$lines, $utf8WithoutBom)
}

try {
  Set-Location -LiteralPath $projectRoot
  Initialize-ToolchainPath
  Repair-EnvironmentEncoding

  if (-not (Get-Command node -ErrorAction SilentlyContinue) -or
      -not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw 'pnpm is not available. Install Node.js and enable Corepack first.'
  }

  Write-Host 'Checking Docker...' -ForegroundColor Cyan
  if (-not (Test-DockerReady)) {
    throw 'Open Docker Desktop, wait until it is running, then use this shortcut again.'
  }

  Write-Host 'Starting local Supabase...' -ForegroundColor Cyan
  & pnpm db:start
  if ($LASTEXITCODE -ne 0) {
    throw 'Supabase failed to start.'
  }

  $supabaseStatus = & pnpm db:status -o env
  if ($LASTEXITCODE -ne 0) {
    throw 'Supabase started, but its local credentials could not be read.'
  }
  Set-LocalEnvironment -StatusLines $supabaseStatus

  if (-not (Test-LocalPort -Port 3000)) {
    Write-Host 'Starting the Weekend School web app...' -ForegroundColor Cyan
    $escapedRoot = $projectRoot.Replace("'", "''")
    $webCommand = "Set-Location -LiteralPath '$escapedRoot'; pnpm dev; if (`$LASTEXITCODE -ne 0) { Read-Host 'The web app stopped. Press Enter to close' }"
    Start-Process -FilePath 'powershell.exe' -ArgumentList @(
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-Command', $webCommand
    ) -WindowStyle Minimized
  }

  Write-Host 'Waiting for the web app...' -ForegroundColor Cyan
  Wait-ForCondition -TimeoutSeconds 120 -Description 'the Weekend School web app' -Condition {
    Test-LocalPort -Port 3000
  }

  Write-Host 'Opening Weekend School.' -ForegroundColor Green
  Start-Process $appUrl
}
catch {
  Write-Host ''
  Write-Host "Startup failed: $($_.Exception.Message)" -ForegroundColor Red
  Read-Host 'Press Enter to close'
  exit 1
}
