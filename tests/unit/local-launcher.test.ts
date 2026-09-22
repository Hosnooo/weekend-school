import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

describe('Windows local launcher', () => {
  it('requires Docker to be running and starts the remaining dependencies without resetting data', async () => {
    const script = await readFile(join(process.cwd(), 'scripts', 'start-local.ps1'), 'utf8');

    expect(script).not.toContain('Docker Desktop.exe');
    expect(script).not.toContain('Starting Docker Desktop');
    expect(script).toContain('Open Docker Desktop, wait until it is running');
    expect(script).toContain('function Initialize-ToolchainPath');
    expect(script).toContain('function Repair-EnvironmentEncoding');
    expect(script).toContain('codex-primary-runtime');
    expect(script).toContain('Get-Command node');
    expect(script).toContain('docker info');
    expect(script).toContain('function Test-DockerReady');
    expect(script).toContain("$ErrorActionPreference = 'Continue'");
    expect(script).toContain('pnpm db:start');
    expect(script).not.toContain('pnpm db:reset');
    expect(script).toContain('.env.local');
    expect(script).toContain('[System.Collections.Generic.List[string]]::new()');
    expect(script).toContain('foreach ($existingLine in @(Get-Content');
    expect(script).toContain('[System.Text.UTF8Encoding]::new($false)');
    expect(script).toContain('[System.IO.File]::WriteAllLines');
    expect(script).toContain('[System.IO.File]::WriteAllBytes');
    expect(script).not.toContain('Set-Content -LiteralPath $environmentPath');
    expect(script).toContain('pnpm dev');
    expect(script).toContain('http://127.0.0.1:3000/en/login');
  });

  it('installs a desktop shortcut that targets the maintained launcher', async () => {
    const script = await readFile(
      join(process.cwd(), 'scripts', 'install-desktop-shortcut.ps1'),
      'utf8'
    );

    expect(script).toContain('WScript.Shell');
    expect(script).toContain('DesktopDirectory');
    expect(script).toContain('start-local.ps1');
    expect(script).toContain('Weekend School.lnk');
  });
});
