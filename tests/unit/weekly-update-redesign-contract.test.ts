import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('weekly update redesign contract', () => {
  it('uses the redesigned page shell for the weekly update route', () => {
    const page = read(
      'src/app/[locale]/(protected)/(teacher)/my-teaching/update/page.tsx'
    );

    expect(page).not.toContain('AdminPage');
    expect(page).toContain('PageHeader');
    expect(page).not.toContain('Card');
    expect(page).toContain('TeachingUpdateEditor');
  });

  it('composes the weekly form as structured cards without changing its domain controls', () => {
    const form = read(
      'src/features/weekly-updates/weekly-update-form.tsx'
    );

    expect(form).toContain("from '@/components/ui/card'");
    expect(form).toContain('<Card');
    expect(form).toContain('sticky-actions');

    expect(form).toContain("t('attendance')");
    expect(form).toContain('template.mainReportLabelEn');
    expect(form).toContain("t('defaultPerformance')");
    expect(form).toContain("t('students')");
    expect(form).toContain("t('performanceOverride')");
    expect(form).toContain("t('commentEn')");
    expect(form).toContain("t('commentAr')");
    expect(form).toContain("t('noStudentsForWeek')");
    expect(form).toContain('<table');
    expect(form).not.toContain("t('exceptions')");
    expect(form).not.toContain('exception-toggle');

    expect(form).toContain('markAllPresent');
    expect(form).toContain('toSparseExceptions');
    expect(form).toContain("value=\"draft\"");
    expect(form).toContain("value=\"submit\"");
  });
});
