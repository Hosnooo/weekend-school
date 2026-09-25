import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

const root = process.cwd();
const exportAction = join(root, 'src/features/exports/export.actions.ts');
const exportsPage = join(
  root,
  'src/app/[locale]/(protected)/(admin)/exports/page.tsx'
);
const exportDownloadRoute = join(root, 'src/app/api/exports/[exportId]/route.ts');
const teacherTree = join(root, 'src/app/[locale]/(protected)/(teacher)');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

describe('Administrator-only export access', () => {
  it('requires explicit Administrator capability before creating an export', () => {
    const source = readFileSync(exportAction, 'utf8');

    expect(source).toContain('requireAdministrator');
    expect(source).toContain('await requireAdministrator(locale)');
    expect(source).not.toContain("requireProfile(locale, 'ADMIN')");
  });

  it('keeps the export UI inside the explicitly protected Administrator surface', () => {
    const source = readFileSync(exportsPage, 'utf8');

    expect(source).toContain('requireAdministrator');
    expect(source).toContain('await requireAdministrator(locale)');
    expect(source).toContain('<ExportPanel');
    expect(source).not.toContain("requireProfile(locale, 'ADMIN')");
  });

  it('requires Administrator capability again at protected download time', () => {
    const source = readFileSync(exportDownloadRoute, 'utf8');

    expect(source).toContain('actorIsAdministrator: actor.isAdministrator');
  });

  it('does not expose export UI or export endpoints from Teacher-only pages', () => {
    for (const file of sourceFiles(teacherTree)) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toContain('@/features/exports');
      expect(source, file).not.toContain('/api/exports');
    }
  });
});
