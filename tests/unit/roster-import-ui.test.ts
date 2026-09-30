import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

const root = process.cwd();

const studentsPage = join(
  root,
  'src/app/[locale]/(protected)/(admin)/students/page.tsx'
);

const importPage = join(
  root,
  'src/app/[locale]/(protected)/(admin)/students/import/page.tsx'
);

const importForm = join(
  root,
  'src/features/roster-csv/roster-import-form.tsx'
);

const templateRoute = join(
  root,
  'src/app/api/roster/template/route.ts'
);

const arabicMessages = JSON.parse(
  readFileSync(join(root, 'messages/ar.json'), 'utf8')
);

describe('Administrator roster CSV import UI', () => {
  it('uses legible Arabic for the new Class preview label', () => {
    const label: string = arabicMessages.students.import.createClass;

    expect(label).toMatch(/[\u0621-\u064A]/u);
    expect(label).not.toContain('?');
  });

  it('separates a new Class name from its creation label clearly', () => {
    const source = readFileSync(importForm, 'utf8');

    expect(source).not.toContain('${row.class.nameEn} ? ${t(\'createClass\')}');
    expect(source).toContain('${row.class.nameEn} · ${t(\'createClass\')}');
  });

  it('links the Students page to CSV import', () => {
    const source = readFileSync(studentsPage, 'utf8');

    expect(source).toContain('href="/students/import"');
    expect(source).toContain("t('importCsv')");
  });

  it('protects the import page with Administrator capability', () => {
    expect(existsSync(importPage)).toBe(true);

    const source = readFileSync(importPage, 'utf8');

    expect(source).toContain('requireAdministrator');
    expect(source).toContain('await requireAdministrator(locale)');
    expect(source).toContain('<RosterImportForm');
  });

  it('provides preview and confirmation UI without trusting hidden resolved ids', () => {
    expect(existsSync(importForm)).toBe(true);

    const source = readFileSync(importForm, 'utf8');

    expect(source).toContain('previewRosterImportAction');
    expect(source).toContain('confirmRosterImportAction');
    expect(source).toContain('type="file"');
    expect(source).toContain('accept=".csv,text/csv"');
    expect(source).not.toContain('encType="multipart/form-data"');
    expect(source).toContain('sourceRows');
    expect(source).not.toContain('resolvedClassId');
    expect(source).not.toContain('resolvedGroupId');
  });

  it('serves an Administrator-only school template', () => {
    expect(existsSync(templateRoute)).toBe(true);

    const source = readFileSync(templateRoute, 'utf8');

    expect(source).toContain('requireAdministrator');
    expect(source).toContain('listRosterImportCatalog');
    expect(source).toContain('buildRosterTemplate');
    expect(source).toContain('text/csv');
  });
});
