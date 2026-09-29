import {describe, expect, it} from 'vitest';

import {selectDashboardWork} from '@/features/dashboard/dashboard.model';

describe('dashboard work selection', () => {
  it('shows started open requests and unfinished report cycles without treating future work as urgent', () => {
    const work = selectDashboardWork(
      [
        {id: 'due', periodStart: '2026-09-01', openCount: 2},
        {id: 'future', periodStart: '2026-10-01', openCount: 1},
        {id: 'completed', periodStart: '2026-09-01', openCount: 0}
      ],
      [
        {id: 'draft', status: 'DRAFT'},
        {id: 'review', status: 'REVIEW'},
        {id: 'finalized', status: 'FINALIZED'}
      ],
      '2026-09-29'
    );

    expect(work).toEqual({
      openRequestIds: ['due'],
      activeCycleIds: ['draft', 'review']
    });
  });
});
