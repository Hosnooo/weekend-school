import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('Class / Subject / Group UX contract', () => {
  it('uses the shared management-list language for Classes', () => {
    const page = read(
      'src/app/[locale]/(protected)/(admin)/classes/page.tsx'
    );

    expect(page).not.toContain('AdminPage');
    expect(page).toContain('PageHeader');

    expect(
      page.includes('DataTable') ||
      page.includes('ClassManagementList')
    ).toBe(true);

    expect(page).not.toContain('<table>');
  });

  it('keeps Class detail focused on Subjects and optional Groups without permanently open edit forms', () => {
    const page = read(
      'src/app/[locale]/(protected)/(admin)/classes/[classId]/page.tsx'
    );
    const subjectCard = read(
      'src/features/classes/class-subject-card.tsx'
    );
    const subjectForm = read(
      'src/features/classes/class-subject-form.tsx'
    );

    const surface = `${page}\n${subjectCard}\n${subjectForm}`;

    expect(surface).not.toContain('<details');
    expect(subjectCard).toContain('DropdownMenu');

    // Hierarchy and teaching coverage must remain visible.
    expect(subjectCard).toContain("t('groupCount'");
    expect(subjectCard).toContain("t('teacherCount'");

    // Assignment management remains directly reachable from the Class surface.
    expect(page).toContain('/teaching-assignments');
  });

  it('keeps the legacy Groups routes as locale-preserving canonical redirects', () => {
    const routes = [
      'src/app/[locale]/(protected)/(admin)/groups/page.tsx',
      'src/app/[locale]/(protected)/(admin)/groups/new/page.tsx',
      'src/app/[locale]/(protected)/(admin)/groups/[id]/edit/page.tsx'
    ];

    for (const route of routes) {
      const source = read(route);

      expect(source).toContain("redirect(`/${locale}/classes`)");
      expect(source).not.toContain('GroupForm');
      expect(source).not.toContain('AdminPage');
    }
  });
});
