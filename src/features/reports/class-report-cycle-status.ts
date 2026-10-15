export type ClassReportCycleDisplayStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'READY_TO_SEND'
  | 'PARTIALLY_SENT'
  | 'SENT'
  | 'DELIVERY_ISSUE';

type BatchStatus = 'DRAFT' | 'REVIEW' | 'FINALIZED';
type ReportStatus = 'DRAFT' | 'READY' | 'SENT' | 'FAILED';

/** Display actual delivery progress, not merely whether a batch was finalized. */
export function deriveClassReportCycleDisplayStatus(
  batchStatus: BatchStatus,
  reports: readonly {status: ReportStatus}[]
): ClassReportCycleDisplayStatus {
  if (batchStatus !== 'FINALIZED') return batchStatus;

  const currentReports = reports.filter(({status}) => status !== 'DRAFT');
  if (currentReports.some(({status}) => status === 'FAILED')) {
    return 'DELIVERY_ISSUE';
  }

  const sent = currentReports.filter(({status}) => status === 'SENT').length;
  if (sent > 0 && sent === currentReports.length) return 'SENT';
  if (sent > 0) return 'PARTIALLY_SENT';
  return 'READY_TO_SEND';
}
