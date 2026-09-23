import {describe, expect, it} from 'vitest';

import * as dashboardModel from '@/features/dashboard/dashboard.model';
import {schoolWeekForDate, summarizeGroupSubmissions} from '@/features/dashboard/dashboard.model';

describe('dashboard summary rules', () => {
  it('uses the Monday-through-Sunday week containing the school-local date', () => {
    expect(schoolWeekForDate('2026-09-20')).toEqual({start: '2026-09-14', end: '2026-09-20'});
    expect(schoolWeekForDate('2026-09-21')).toEqual({start: '2026-09-21', end: '2026-09-27'});
    expect(schoolWeekForDate('2027-01-01')).toEqual({start: '2026-12-28', end: '2027-01-03'});
  });

  it('counts each active group once, even with multiple submitted sessions', () => {
    expect(summarizeGroupSubmissions(
      [{id: 'a', nameEn: 'A', nameAr: null}, {id: 'b', nameEn: 'B', nameAr: null}],
      [{group_id: 'a'}, {group_id: 'a'}, {group_id: 'retired'}]
    )).toEqual({submittedCount: 1, groups: [
      {id: 'a', nameEn: 'A', nameAr: null, submitted: true},
      {id: 'b', nameEn: 'B', nameAr: null, submitted: false}
    ]});
  });

  it('provides teacher-context update summarization instead of group-only completion', () => {
    const summarizeTeachingUpdates = (dashboardModel as unknown as {
      summarizeTeachingUpdates?: unknown;
    }).summarizeTeachingUpdates;

    expect(summarizeTeachingUpdates).toBeTypeOf('function');
  });
});
