import {describe, expect, it} from 'vitest';

import {currentGroupForDate} from '@/features/students/student.model';

const oldGroup = {id: 'old', nameEn: 'Old', nameAr: null};
const newGroup = {id: 'new', nameEn: 'New', nameAr: null};

describe('current student group', () => {
  it('uses effective dates rather than the first open membership', () => {
    expect(currentGroupForDate([
      {startsOn: '2026-09-01', endsOn: '2026-09-21', group: oldGroup},
      {startsOn: '2026-09-22', endsOn: null, group: newGroup}
    ], '2026-09-21')).toEqual(oldGroup);
    expect(currentGroupForDate([
      {startsOn: '2026-09-01', endsOn: '2026-09-21', group: oldGroup},
      {startsOn: '2026-09-22', endsOn: null, group: newGroup}
    ], '2026-09-22')).toEqual(newGroup);
  });

  it('does not show a future assignment as current', () => {
    expect(currentGroupForDate([
      {startsOn: '2026-10-01', endsOn: null, group: newGroup}
    ], '2026-09-22')).toBeNull();
  });
});
