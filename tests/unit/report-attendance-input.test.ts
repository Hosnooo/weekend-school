import {describe,expect,it} from 'vitest';
import {attendanceInputIssue} from '@/features/reports/report-attendance-input';

function data(attended: string, total: string) {
  const form = new FormData();
  form.append('studentId','student-1');
  form.append('attendanceAttended:student-1', attended);
  form.append('attendanceTotal:student-1', total);
  return form;
}
describe('administrator attendance correction guidance', () => {
  it('allows blank fields to keep teacher attendance', () => {
    expect(attendanceInputIssue(data('',''))).toBeNull();
    expect(attendanceInputIssue(data('1','2'))).toBeNull();
  });
  it('identifies incomplete, noninteger and overtotal attendance', () => {
    expect(attendanceInputIssue(data('1',''))).toEqual({studentId:'student-1',reason:'attendanceIncomplete'});
    expect(attendanceInputIssue(data('1.5','2'))).toEqual({studentId:'student-1',reason:'attendanceInvalid'});
    expect(attendanceInputIssue(data('-1','2'))).toEqual({studentId:'student-1',reason:'attendanceInvalid'});
    expect(attendanceInputIssue(data('4','2'))).toEqual({studentId:'student-1',reason:'attendanceExceeds'});
  });
});
