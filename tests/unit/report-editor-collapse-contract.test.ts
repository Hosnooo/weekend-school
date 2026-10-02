// @vitest-environment node

import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

function read(relative: string) {
  return readFileSync(join(process.cwd(), relative), 'utf8');
}

describe('Class Report Cycle editor disclosure', () => {
  it('opens the matching source-card editor and closes after save or cancel', () => {
    const sourceReview = read(
      'src/features/reports/report-cycle-source-review.tsx'
    );
    const form = read('src/features/reports/report-edit-form.tsx');

    expect(sourceReview).toContain('const editorId =');
    expect(sourceReview).toContain('href={`#${editorId}`}');
    expect(sourceReview).toContain('report-source-editable');
    expect(sourceReview).toContain('report-edit-panel report-source-editor');
    expect(sourceReview).toContain('Save & close');
    expect(sourceReview).toContain('Cancel');

    expect(form).toContain("window.location.hash = 'report-edit-closed'");
    expect(form).toContain('formRef.current?.reset()');
    expect(sourceReview).not.toContain('rebuildClassReportReviewContextAction');
  });
});
