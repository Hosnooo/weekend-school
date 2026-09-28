import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

const root = process.cwd();

const route = join(
  root,
  'src/app/api/roster/export/route.ts'
);

const panel = join(
  root,
  'src/features/roster-csv/roster-export-panel.tsx'
);

const exportsPage = join(
  root,
  'src/app/[locale]/(protected)/(admin)/exports/page.tsx'
);

const operationalExportService = join(
  root,
  'src/features/exports/export.service.ts'
);

describe('Administrator roster export UI', () => {
  it('adds a separate roster export panel without replacing operational exports', () => {
    expect(existsSync(panel)).toBe(true);

    const pageSource = readFileSync(exportsPage, 'utf8');

    expect(pageSource).toContain('<ExportPanel');
    expect(pageSource).toContain('<RosterExportPanel');
  });

  it('allows only SCHOOL and CLASS roster scopes', () => {
    expect(existsSync(panel)).toBe(true);

    const source = readFileSync(panel, 'utf8');

    expect(source).toContain('scope=SCHOOL');
    expect(source).toContain('scope=CLASS');
    expect(source).not.toContain('scope=GROUP');
    expect(source).not.toContain('scope=STUDENT');
    expect(source).not.toContain('scope=SUBJECT');
  });

  it('protects the download route and rejects unsupported scopes', () => {
    expect(existsSync(route)).toBe(true);

    const source = readFileSync(route, 'utf8');

    expect(source).toContain('requireAdministrator');
    expect(source).toContain('collectRosterExportRows');
    expect(source).toContain('buildRosterExportCsv');
    expect(source).toContain("scope !== 'SCHOOL'");
    expect(source).toContain("scope !== 'CLASS'");
    expect(source).toContain('text/csv; charset=utf-8');
  });

  it('keeps the existing operational export service unchanged in scope model', () => {
    const source = readFileSync(
      operationalExportService,
      'utf8'
    );

    expect(source).toContain("'SCHOOL'");
    expect(source).toContain("'CLASS'");
    expect(source).toContain("'SUBJECT'");
    expect(source).toContain("'GROUP'");
    expect(source).toContain("'STUDENT'");
    expect(source).toContain("'TEACHER'");
  });
});
