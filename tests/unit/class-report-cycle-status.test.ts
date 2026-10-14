import {describe, expect, it} from 'vitest';

import {deriveClassReportCycleDisplayStatus} from '@/features/reports/class-report-cycle-status';

describe('Class Report Cycle visible delivery status', () => {
  it('preserves collection and review statuses before finalization', () => {
    expect(deriveClassReportCycleDisplayStatus('DRAFT', [{status: 'SENT'}])).toBe('DRAFT');
    expect(deriveClassReportCycleDisplayStatus('REVIEW', [{status: 'SENT'}])).toBe('REVIEW');
  });

  it('shows ready to send only if no current reports have been sent', () => {
    expect(deriveClassReportCycleDisplayStatus('FINALIZED', [{status: 'READY'}])).toBe('READY_TO_SEND');
    expect(deriveClassReportCycleDisplayStatus('FINALIZED', [{status: 'DRAFT'}, {status: 'READY'}])).toBe('READY_TO_SEND');
  });

  it('shows sent when all current reports were sent', () => {
    expect(deriveClassReportCycleDisplayStatus('FINALIZED', [{status: 'SENT'}, {status: 'SENT'}])).toBe('SENT');
    expect(deriveClassReportCycleDisplayStatus('FINALIZED', [{status: 'DRAFT'}, {status: 'SENT'}])).toBe('SENT');
  });

  it('shows partially sent if at least one current report remains ready', () => {
    expect(deriveClassReportCycleDisplayStatus('FINALIZED', [{status: 'SENT'}, {status: 'READY'}])).toBe('PARTIALLY_SENT');
  });

  it('prioritizes failed delivery over partially sent or sent', () => {
    expect(deriveClassReportCycleDisplayStatus('FINALIZED', [{status: 'SENT'}, {status: 'FAILED'}])).toBe('DELIVERY_ISSUE');
    expect(deriveClassReportCycleDisplayStatus('FINALIZED', [{status: 'FAILED'}])).toBe('DELIVERY_ISSUE');
  });
});
