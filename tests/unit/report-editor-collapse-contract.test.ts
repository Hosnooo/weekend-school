// @vitest-environment node

import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

function read(relative: string) {
  return readFileSync(join(process.cwd(), relative), 'utf8');
}

describe('Class Report Cycle editor disclosure', () => {
  it('opens one report editor from Edit update and closes after save or cancel', () => {
    const sources = read('src/features/reports/report-cycle-sources.tsx');
    const review = read('src/features/reports/class-report-cycle-review.tsx');

    expect(sources).toContain('const editorId =');
    expect(sources).toContain('href={`#${editorId}`}');
    expect(sources).not.toContain('href="#report-edit"');

    expect(review).toContain('report-edit-panel');
    expect(review).toContain('.report-edit-panel:target');
    expect(review).toContain('Save & close');
    expect(review).toContain('Cancel');
    expect(review).toContain('href="#report-edit-closed"');
    expect(review).not.toContain('rebuildClassReportReviewContextAction');
  });
});
