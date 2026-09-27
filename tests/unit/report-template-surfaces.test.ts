import {existsSync, readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');

describe('report template surfaces', () => {
  it('has an administrator report-template action and form', () => {
    expect(
      existsSync('src/features/reports/report-template.actions.ts')
    ).toBe(true);

    expect(
      existsSync('src/features/reports/report-template-form.tsx')
    ).toBe(true);
  });

  it('loads the report template on the Settings page', () => {
    const page = source(
      'src/app/[locale]/(protected)/(admin)/settings/page.tsx'
    );

    expect(page).toContain('ReportTemplateForm');
    expect(page).toContain('getActiveReportTemplate');
  });

  it('loads the active template for both teacher weekly surfaces', () => {
    const update = source(
      'src/app/[locale]/(protected)/(teacher)/my-teaching/update/page.tsx'
    );
    const history = source(
      'src/app/[locale]/(protected)/(teacher)/history/[id]/page.tsx'
    );

    for (const page of [update, history]) {
      expect(page).toContain('getActiveReportTemplate');
      expect(page).toContain('template={template}');
    }
  });
});
