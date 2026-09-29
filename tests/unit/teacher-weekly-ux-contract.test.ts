import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

import * as weeklyModel from '@/features/weekly-updates/weekly-update.model';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('Teacher Teaching Update UX contract', () => {
  it('maps each submission state to exactly one next action', () => {
    const weeklyActionForStatus = (
      weeklyModel as typeof weeklyModel & {
        weeklyActionForStatus?: (
          status: 'MISSING' | 'DRAFT' | 'SUBMITTED'
        ) => 'startUpdate' | 'continueDraft' | 'viewSubmittedUpdate';
      }
    ).weeklyActionForStatus;

    expect(weeklyActionForStatus).toBeTypeOf('function');
    if (!weeklyActionForStatus) return;

    expect(weeklyActionForStatus('MISSING')).toBe('startUpdate');
    expect(weeklyActionForStatus('DRAFT')).toBe('continueDraft');
    expect(weeklyActionForStatus('SUBMITTED')).toBe('viewSubmittedUpdate');
  });

  it('renders My Teaching as the flexible Teaching Updates work queue', () => {
    const page = read(
      'src/app/[locale]/(protected)/(teacher)/my-teaching/page.tsx'
    );

    expect(page).not.toContain('AdminPage');
    expect(page).toContain('PageHeader');
    expect(page).toContain('teacher-new-update-list');
    expect(page).toContain('createTeachingUpdateAction');
    expect(page).toContain('listOpenTeachingUpdates');
    expect(page).toContain('TeachingUpdateTaskList');
    expect(page).toContain('EmptyState');

    const taskList = readFileSync(
      'src/features/teaching-updates/teaching-update-task-list.tsx',
      'utf8'
    );

    expect(taskList).toContain('submissionId');

    expect(page).toContain('createTeachingUpdateAction');
    expect(page).toContain('listOpenTeachingUpdates');
    expect(page).toContain('TeachingUpdateTaskList');
    expect(taskList).toContain('submissionId');

    const en = JSON.parse(read('messages/en.json'));
    const ar = JSON.parse(read('messages/ar.json'));

    for (const messages of [en, ar]) {
      expect(messages.teachingUpdates.title).toBeTruthy();
      expect(messages.teachingUpdates.newUpdate).toBeTruthy();
      expect(messages.teachingUpdates.openUpdates).toBeTruthy();
      expect(messages.teachingUpdates.continue).toBeTruthy();
    }

    expect(page).toContain('context.classNameEn');
    expect(page).toContain('context.subjectNameEn');
    expect(page).toContain('context.groupNameEn');
    expect(page).not.toContain('context.studentCount');

    expect(page).not.toContain("locale==='ar'?'");
  });
});
