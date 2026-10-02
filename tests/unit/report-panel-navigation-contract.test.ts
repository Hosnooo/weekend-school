// @vitest-environment node

import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

function read(relative: string) {
  return readFileSync(join(process.cwd(), relative), 'utf8');
}

describe('Report Cycle panel navigation contract', () => {
  it('opens report editing by hash only inside the source card', () => {
    const sourceReview = read(
      'src/features/reports/report-cycle-source-review.tsx'
    );

    expect(sourceReview).toContain('href={`#${editorId}`}');
    expect(sourceReview).toContain('report-source-editor');
    expect(sourceReview).not.toContain('?edit=${encodeURIComponent(editorId)}');
  });

  it('saves and cancels inside the edit panel without redirecting the page', () => {
    const form = read('src/features/reports/report-edit-form.tsx');
    const actions = read('src/features/reports/class-report-review.actions.ts');
    const inlineStart = actions.indexOf(
      'export async function saveClassReportReviewWithAttendanceInlineAction'
    );
    const redirectingStart = actions.indexOf(
      'export async function saveClassReportReviewWithAttendanceAction',
      inlineStart + 1
    );
    const inlineAction = actions.slice(inlineStart, redirectingStart);

    expect(form).toContain('event.preventDefault()');
    expect(form).toContain('saveAction(formData)');
    expect(form).toContain("window.location.hash = 'report-edit-closed'");
    expect(form).toContain('formRef.current?.reset()');
    expect(form).toContain("new CustomEvent('report-cycle:saved'");
    expect(inlineAction).not.toContain('redirect(');
    expect(inlineAction).not.toContain('revalidatePath(');
  });

  it('switches and refreshes Email Review locally without a GET form or Show email submit', () => {
    const review = read('src/features/reports/class-report-cycle-review.tsx');
    const panel = read('src/features/reports/report-email-review.tsx');

    expect(review).toContain('<ReportEmailReview');
    expect(review).toContain('loadPreviewAction={getClassReportCycleEmailPreviewAction}');
    expect(review).not.toContain('<form className="row-actions" method="get">');
    expect(review).not.toContain('ui.showEmail');

    expect(panel).toContain('onChange={(event) =>');
    expect(panel).toContain('loadPreviewAction({');
    expect(panel).toContain("window.addEventListener('report-cycle:saved', refresh)");
    expect(panel).toContain('setPreview(result.preview)');
  });

  it('returns the exact rendered parent email from the panel preview action', () => {
    const action = read('src/features/reports/class-report-preview.actions.ts');

    expect(action).toContain('getClassReportCycleLivePreview');
    expect(action).toContain('getClassReportPreviewRecipients');
    expect(action).toContain('renderReportEmailSubject(snapshot)');
    expect(action).toContain('renderReportEmail(snapshot)');
  });
});
