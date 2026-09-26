import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('Teacher History and Profile UX contract', () => {
  it('renders submitted History as a scan-friendly shared-component list', () => {
    const page = read(
      'src/app/[locale]/(protected)/(teacher)/history/page.tsx'
    );

    expect(page).not.toContain('AdminPage');
    expect(page).toContain('PageHeader');
    expect(page).toContain('DataTable');
    expect(page).toContain('StatusBadge');
    expect(page).toContain('EmptyState');

    expect(page).toContain('weekStart');
    expect(page).toContain('classNameEn');
    expect(page).toContain('subjectNameEn');
    expect(page).toContain('groupNameEn');
    expect(page).toContain("t('submitted')");
  });

  it('keeps submitted History detail read-only in the redesigned shell', () => {
    const page = read(
      'src/app/[locale]/(protected)/(teacher)/history/[id]/page.tsx'
    );

    expect(page).not.toContain('AdminPage');
    expect(page).toContain('PageHeader');
    expect(page).toContain('Card');
    expect(page).toContain('WeeklyUpdateForm');
    expect(page).toContain('readOnly');
  });

  it('renders My Profile from translations with shared read-only components', () => {
    const page = read(
      'src/app/[locale]/(protected)/(teacher)/profile/page.tsx'
    );

    expect(page).not.toContain('AdminPage');
    expect(page).toContain('PageHeader');
    expect(page).toContain('Card');
    expect(page).toContain('StatusBadge');
    expect(page).toContain('EmptyState');
    expect(page).toContain('getTranslations');

    expect(page).not.toContain("locale==='ar'");
    expect(page).not.toContain("locale === 'ar'");
    expect(page).not.toContain("'Inactive'");
  });

  it('keeps legacy My Groups as a locale-preserving redirect', () => {
    const page = read(
      'src/app/[locale]/(protected)/(teacher)/my-groups/page.tsx'
    );

    expect(page).toContain("redirect(`/${locale}/my-teaching`)");
  });
});
