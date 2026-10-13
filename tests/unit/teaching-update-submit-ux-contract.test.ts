import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Teaching Update draft and submission usability', () => {
  const editor = read('src/features/teaching-updates/teaching-update-editor.tsx');
  const css = read('src/app/design-system.css');
  const actions = read('src/features/teaching-updates/teaching-update.actions.ts');
  const page = read('src/app/[locale]/(protected)/(teacher)/my-teaching/update/page.tsx');
  const en = JSON.parse(read('messages/en.json')).teachingUpdates;
  const ar = JSON.parse(read('messages/ar.json')).teachingUpdates;

  it('uses comment-matched visual styling for numeric attendance', () => {
    expect(editor).toContain('teacher-attendance-input');
    expect(editor).toContain('teacher-attendance-fields');
    expect(css).toContain('.teacher-attendance-fields .teacher-attendance-input');
    expect(css).toContain('background: var(--surface);');
    expect(css).toContain('border: 1px solid var(--border);');
  });

  it('marks submission-required fields without blocking partial draft saves', () => {
    expect(editor).toContain('teacher-required-star');
    expect(editor).toContain('noValidate');
    expect(editor).toContain('requiredFieldsHint');
    expect(editor).toContain('setShowSubmitIssues(true)');
    expect(editor).not.toContain('disabled={!canSubmit}');
    expect(en.requiredFieldsHint).toContain('draft');
    expect(ar.requiredFieldsHint).toContain('المسودة');
  });

  it('names the missing student fields in both languages', () => {
    for (const key of [
      'missingBoth', 'missingAttended', 'missingTotal', 'invalidTotal',
      'invalidAttended', 'attendedExceedsTotal', 'noDates', 'futureCoverage'
    ]) {
      expect(en.submitIssue[key]).toBeTruthy();
      expect(ar.submitIssue[key]).toBeTruthy();
    }
    expect(editor).toContain('studentName(issue.studentId)');
  });

  it('uses server-side saved data and typed rejection reasons', () => {
    expect(actions).toContain('const saved = await getTeachingUpdate(');
    expect(actions).toContain('getTeachingUpdateSubmitIssues({');
    expect(actions).toContain("failure = 'conflict'");
    expect(actions).toContain("failure = 'incomplete'");
    expect(page).toContain('submissionErrorKeys');
    expect(en.submitError.incomplete).toContain('missing fields');
  });

  it('keeps accurate save feedback after failures and clears old submit errors after saving', () => {
    expect(editor).toContain("state.status === 'error'");
    expect(editor).toContain("t('notSaved')");
    expect(editor).toContain('const effectiveVersion');
    expect(editor).toContain('value={effectiveVersion}');
    expect(actions).toContain('savedVersion: (parsed.data.expectedVersion ?? 0) + 1');
    expect(editor).toContain("submissionError && state.status !== 'saved'");
    for (const key of ['validation','save','conflict','permission','locked','context']) {
      expect(en.saveIssue[key]).toBeTruthy();
      expect(ar.saveIssue[key]).toBeTruthy();
    }
  });
});
