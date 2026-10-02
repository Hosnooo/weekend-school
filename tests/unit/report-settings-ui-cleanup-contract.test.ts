// @vitest-environment node

import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

function read(relative: string) {
  return readFileSync(join(process.cwd(), relative), 'utf8');
}

describe('Report and Settings UI cleanup', () => {
  it('keeps each report editor inside the source surface instead of a separate Student Reports stage', () => {
    const page = read('src/app/[locale]/(protected)/(admin)/reports/workspace/[batchId]/page.tsx');
    const review = read('src/features/reports/class-report-cycle-review.tsx');
    const sourceReview = read(
      'src/features/reports/report-cycle-source-review.tsx'
    );

    expect(page).not.toContain('<ReportCycleSources');
    expect(review).toContain('<ReportCycleSourceReview');
    expect(sourceReview).toContain('classCycle.sources');
    expect(sourceReview).toContain('report-source-editable');
    expect(sourceReview).toContain('<ReportEditForm');
    expect(review).not.toContain("t('studentReportsStage')");
  });

  it('organizes Settings into School, Student reports, and Parent email sections', () => {
    const page = read('src/app/[locale]/(protected)/(admin)/settings/page.tsx');
    const school = read('src/features/school-settings/school-settings-form.tsx');
    const template = read('src/features/reports/report-template-form.tsx');

    expect(page).toContain('settings-page-sections');
    expect(school).toContain('settings-section-card school-settings-section');
    expect(template).toContain('settings-section-card report-settings-section');
    expect(template).toContain('settings-section-card email-settings-section');
  });

  it('uses compact report hierarchy rather than oversized stage titles', () => {
    const css = read('src/app/report-cycle-hierarchy.css');

    expect(css).not.toContain('font-size: 1.25rem');
    expect(css).toContain('font-size: 1.125rem');
  });

  it('structures Email Review into selector, metadata, and body regions', () => {
    const panel = read('src/features/reports/report-email-review.tsx');

    expect(panel).toContain('report-email-review-controls');
    expect(panel).toContain('report-email-review-meta');
    expect(panel).toContain('report-email-review-body');
  });
});
