// @vitest-environment node

import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

function read(relative: string) {
  return readFileSync(join(process.cwd(), relative), 'utf8');
}

describe('Report Cycle visual hierarchy', () => {
  it('gives workflow stages stronger typography than report context titles', () => {
    const review = read('src/features/reports/class-report-cycle-review.tsx');

    expect(review).toContain("reportEdit: 'Report edit'");
    expect(review).toContain("reportEdit: 'تحرير التقرير'");
    expect(review).toContain('className="section-heading report-stage-heading"');
    expect(review).toContain('className="stack report-stage"');
    expect(review).toContain('<h2>{ui.emailReview}</h2>');
    expect(review).toContain("<h2>{t('sendStage')}</h2>");

    expect(review).toContain('.report-cycle-sources .section-heading h2');
    expect(review).toContain('.report-stage-heading h2');
    expect(review).toContain('.report-stage h2');
    expect(review).toContain('font-size: 1.25rem');
    expect(review).toContain('font-weight: 750');
    expect(review).toContain('.report-cycle-student-reports h3');
    expect(review).toContain('font-size: 1.0625rem');
  });
});
