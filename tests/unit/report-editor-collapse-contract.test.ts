// @vitest-environment node

import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

function read(relative: string) {
  return readFileSync(join(process.cwd(), relative), 'utf8');
}

describe('Class Report Cycle editor disclosure', () => {
  it('opens one report editor from Edit update and closes after save or cancel', () => {
    const page = read(
      'src/app/[locale]/(protected)/(admin)/reports/workspace/[batchId]/page.tsx'
    );
    const sources = read('src/features/reports/report-cycle-sources.tsx');
    const review = read('src/features/reports/class-report-cycle-review.tsx');

    expect(page).toContain('edit?: string;');
    expect(page).toContain('selectedEditContextKey={query.edit}');

    expect(sources).toContain('const contextKey =');
    expect(sources).toContain('?edit=${encodeURIComponent(contextKey)}#report-edit');
    expect(sources).not.toContain('href="#report-edit"');

    expect(review).toContain('selectedEditContextKey');
    expect(review).toContain('const isEditing = selectedEditContextKey === contextKey');
    expect(review).toContain('Save & close');
    expect(review).toContain('Cancel');
    expect(review).not.toContain('rebuildClassReportReviewContextAction');
  });
});
