import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

import * as dashboardModel from '@/features/dashboard/dashboard.model';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('Administrator dashboard UX contract', () => {
  it('derives Teacher attention from login linkage and current assignments', () => {
    const summarizeTeacherAttention = (
      dashboardModel as typeof dashboardModel & {
        summarizeTeacherAttention?: (
          teachers: Array<{id: string; hasLogin: boolean}>,
          assignments: Array<{
            teacherId: string;
            startsOn: string;
            endsOn: string | null;
          }>,
          onDate: string
        ) => {
          teachersWithoutLogin: number;
          teachersWithoutAssignments: number;
        };
      }
    ).summarizeTeacherAttention;

    expect(summarizeTeacherAttention).toBeTypeOf('function');
    if (!summarizeTeacherAttention) return;

    expect(
      summarizeTeacherAttention(
        [
          {id: 't1', hasLogin: true},
          {id: 't2', hasLogin: false},
          {id: 't3', hasLogin: true}
        ],
        [
          {
            teacherId: 't1',
            startsOn: '2026-09-01',
            endsOn: null
          },
          {
            teacherId: 't2',
            startsOn: '2026-08-01',
            endsOn: '2026-09-20'
          }
        ],
        '2026-09-25'
      )
    ).toEqual({
      teachersWithoutLogin: 1,
      teachersWithoutAssignments: 2
    });
  });

  it('prioritizes actionable attention over a raw count dashboard', () => {
    const page = read(
      'src/app/[locale]/(protected)/(admin)/dashboard/page.tsx'
    );

    expect(page).not.toContain('AdminPage');
    expect(page).toContain('PageHeader');

    expect(page).toContain('teachersWithoutLogin');
    expect(page).toContain('teachersWithoutAssignments');
    expect(page).toContain('missingCount');
    expect(page).toContain('unresolvedAttendanceConflicts');
    expect(page).toContain('readyReports');
    expect(page).toContain('failedDeliveries');

    expect(page).toContain('/teachers');
    expect(page).toContain('/teaching-assignments');
    expect(page).toContain('/reports');
    expect(page).toContain('#attendance-conflicts');

    expect(page).not.toContain("locale === 'ar'");
  });
});
