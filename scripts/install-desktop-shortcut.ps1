[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$launcherPath = Join-Path $PSScriptRoot 'start-local.ps1'
$desktopPath = [Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory)
$shortcutPath = Join-Path $desktopPath 'Weekend School.lnk'
$powershellPath = Join-Path $PSHOME 'powershell.exe'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershellPath
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcherPath`""
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Description = 'Start Docker, Supabase, and the Weekend School web app'
$shortcut.IconLocation = "$env:SystemRoot\System32\imageres.dll,5"
$shortcut.WindowStyle = 1
$shortcut.Save()

Write-Host "Created $shortcutPath" -ForegroundColor Green
