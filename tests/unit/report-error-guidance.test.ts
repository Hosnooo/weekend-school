import {describe,expect,it} from 'vitest';
import {reportWorkflowErrorCode} from '@/features/reports/report-error-guidance';

describe('safe Class Report Cycle error guidance', () => {
  it('explains actionable report failures', () => {
    expect(reportWorkflowErrorCode(new Error('delivered or pending reports cannot be reopened'))).toBe('sent');
    expect(reportWorkflowErrorCode(new Error('unresolved attendance conflicts block report finalization'))).toBe('attendance');
    expect(reportWorkflowErrorCode(new Error('Review included Teaching Updates before finalizing reports'))).toBe('sources');
    expect(reportWorkflowErrorCode({code:'42501',message:'sensitive admin detail'})).toBe('permission');
    expect(reportWorkflowErrorCode({code:'99999',message:'secret'})).toBe('save');
  });
});
