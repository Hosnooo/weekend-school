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
    const panel = read('src/features/reports/report-edit-panel.tsx');
    const workspace = read(
      'src/app/[locale]/(protected)/(admin)/reports/workspace/[batchId]/page.tsx'
    );
    const cycle = read('src/features/reports/class-report-cycle-review.tsx');

    expect(sourceReview).toContain('const editorId =');
    // Opening a prepared/finalized editor must pass the server-side reopen guard.
    expect(sourceReview).toContain('action={openClassReportEditorAction}');
    expect(sourceReview).toContain('id={editorId}');
    const actions = read('src/features/reports/class-report-review.actions.ts');
    expect(actions).toContain('await reopenAdminReportWorkspace(');
    expect(actions).toContain(
      'redirect(`${workspacePath}?editor=${encodeURIComponent(editorId)}#${editorId}`)'
    );
    expect(workspace).toContain('openedEditorId={query.editor}');
    expect(cycle).toContain('openedEditorId={openedEditorId}');
    expect(sourceReview).toContain('report-source-editable');
    expect(sourceReview).toContain('<ReportEditPanel');
    expect(sourceReview).toContain('openOnArrival={openedEditorId === editorId}');
    expect(panel).toContain('report-edit-panel report-source-editor');
    expect(panel).toContain('hidden={!open}');
    expect(panel).toContain("window.addEventListener('hashchange', syncFromHash)");
    expect(sourceReview).toContain('Save & close');
    expect(sourceReview).toContain('Cancel');

    expect(form).toContain("window.location.hash = 'report-edit-closed'");
    expect(form).toContain('formRef.current?.reset()');
    expect(sourceReview).not.toContain('rebuildClassReportReviewContextAction');
  });
});
