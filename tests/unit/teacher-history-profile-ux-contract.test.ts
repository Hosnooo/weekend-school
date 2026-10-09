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
    expect(page).toContain('Badge');
    expect(page).toContain('EmptyState');

    expect(page).toContain('listSubmittedTeachingUpdates');
    expect(page).toContain('coverageKind');
    expect(page).toContain('periodStart');
    expect(page).toContain('periodEnd');
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
    expect(page).toContain('detail-section');
    expect(page).toContain('getTeachingUpdate');
    expect(page).toContain('TeachingUpdateEditor');
    expect(page).toContain("submission.status !== 'SUBMITTED'");
  });

  it('renders the one shared My account screen for Teacher and Administrator profiles', () => {
    const page = read(
      'src/app/[locale]/(protected)/account/page.tsx'
    );

    expect(page).not.toContain('AdminPage');
    expect(page).toContain('PageHeader');
    expect(page).toContain('detail-section');
    expect(page).toContain('StatusBadge');
    expect(page).toContain('EmptyState');
    expect(page).toContain('getTranslations');
    expect(page).toContain('AccountWorkspace');

    expect(page).not.toContain("locale==='ar'");
    expect(page).not.toContain("locale === 'ar'");
    expect(page).not.toContain("'Inactive'");
  });

  it('keeps the former Teacher profile URL as a locale-preserving account redirect', () => {
    expect(read('src/app/[locale]/(protected)/(teacher)/profile/page.tsx'))
      .toContain('redirect(`/${locale}/account`)');
  });

  it('keeps legacy My Groups as a locale-preserving redirect', () => {
    const page = read(
      'src/app/[locale]/(protected)/(teacher)/my-groups/page.tsx'
    );

    expect(page).toContain("redirect(`/${locale}/my-teaching`)");
  });
});
