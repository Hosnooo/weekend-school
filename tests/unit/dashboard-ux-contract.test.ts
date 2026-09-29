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
    const workspace = read('src/features/dashboard/dashboard-workspace.tsx');

    expect(page).not.toContain('AdminPage');
    expect(page).toContain('selectDashboardWork');
    expect(workspace).toContain('PageHeader');
    expect(workspace).toContain('openRequests');
    expect(workspace).toContain('activeCycles');
    expect(workspace).toContain('teachersWithoutLogin');
    expect(workspace).toContain('teachersWithoutAssignments');
    expect(workspace).toContain('summary.conflicts');
    expect(workspace).toContain('/teachers');
    expect(workspace).toContain('/teaching-assignments');
    expect(workspace).toContain('/reports');
    expect(workspace).not.toContain('readyReports');
    expect(workspace).not.toContain('failedDeliveries');
    expect(workspace).not.toContain('missingCount');
  });

  it('orders the dashboard around administrator operations', () => {
    const page = read('src/features/dashboard/dashboard-workspace.tsx');

    expect(page).not.toMatch(/<PageHeader[\\s\\S]*?actions=/);

    const attention = page.indexOf("aria-label={t('attention')}");
    const inProgress = page.indexOf("aria-label={t('inProgress')}");
    const quickActions = page.indexOf("aria-label={t('quickActions')}");

    expect(attention).toBeGreaterThan(-1);
    expect(inProgress).toBeGreaterThan(attention);
    expect(quickActions).toBeGreaterThan(inProgress);

    expect(page.indexOf('href="/students/new"')).toBeGreaterThan(quickActions);
  });
});
