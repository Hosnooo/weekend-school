import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

import * as weeklyModel from '@/features/weekly-updates/weekly-update.model';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('Teacher This Week UX contract', () => {
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

  it('renders This Week as a translated shared-component work queue', () => {
    const page = read(
      'src/app/[locale]/(protected)/(teacher)/my-teaching/page.tsx'
    );

    expect(page).not.toContain('AdminPage');
    expect(page).toContain('PageHeader');
    expect(page).toContain('Card');
    expect(page).toContain('StatusBadge');
    expect(page).toContain('EmptyState');

    expect(page).toContain('weeklyActionForStatus');
    expect(page).toContain('{t(actionKey)}');

    const en = JSON.parse(read('messages/en.json'));
    const ar = JSON.parse(read('messages/ar.json'));

    for (const messages of [en, ar]) {
      expect(messages.weekly.startUpdate).toBeTruthy();
      expect(messages.weekly.continueDraft).toBeTruthy();
      expect(messages.weekly.viewSubmittedUpdate).toBeTruthy();
    }

    expect(page).toContain('context.classNameEn');
    expect(page).toContain('context.subjectNameEn');
    expect(page).toContain('context.groupNameEn');
    expect(page).toContain('context.studentCount');

    expect(page).not.toContain("locale==='ar'?'");
  });
});
