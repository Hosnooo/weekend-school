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
    const css = read('src/app/design-system.css');

    expect(review).toContain("reportEdit: 'Report edit'");
    expect(review).toContain("reportEdit: 'تحرير التقرير'");
    expect(review).toContain('className="section-heading report-stage-heading"');
    expect(review).toContain('className="stack report-stage"');
    expect(review).toContain('<h2>{ui.emailReview}</h2>');
    expect(review).toContain("<h2>{t('sendStage')}</h2>");

    expect(css).toContain('.report-stage-heading h2');
    expect(css).toContain('.report-stage h2');
    expect(css).toContain('font-size: 1.25rem');
    expect(css).toContain('font-weight: 750');
    expect(css).toContain('.report-cycle-student-reports h3');
    expect(css).toContain('font-size: 1.0625rem');
  });
});
