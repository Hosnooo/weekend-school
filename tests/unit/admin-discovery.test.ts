import {describe, expect, it} from 'vitest';

import {summarizeReportDelivery} from '@/features/dashboard/dashboard.model';
import {filterStudents} from '@/features/students/student.model';
import type {StudentListItem} from '@/features/students/student.types';

const students: StudentListItem[] = [
  {id: '1', firstNameEn: 'Amina', lastNameEn: 'Hassan', firstNameAr: 'أمينة', lastNameAr: 'حسن', isActive: true, currentClass: null},
  {id: '2', firstNameEn: 'Omar', lastNameEn: 'Saleh', firstNameAr: null, lastNameAr: null, isActive: true, currentClass: null}
];

describe('admin discovery', () => {
  it('finds students by English or Arabic name', () => {
    expect(filterStudents(students, 'amina').map((student) => student.id)).toEqual(['1']);
    expect(filterStudents(students, 'أمينة').map((student) => student.id)).toEqual(['1']);
    expect(filterStudents(students, 'SALEH').map((student) => student.id)).toEqual(['2']);
  });

  it('counts ready reports and failed recipient deliveries', () => {
    expect(summarizeReportDelivery([{status: 'READY'}, {status: 'SENT'}], [{status: 'FAILED'}, {status: 'SENT'}]))
      .toEqual({readyReports: 1, failedDeliveries: 1});
    expect(summarizeReportDelivery([], [])).toEqual({readyReports: 0, failedDeliveries: 0});
  });
});
