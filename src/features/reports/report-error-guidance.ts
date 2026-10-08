/** Safe reasons for report workflow failures; do not forward arbitrary SQL text. */
export type ReportWorkflowError = 'sent' | 'attendance' | 'sources' | 'stale' | 'permission' | 'rule' | 'save';

export function reportWorkflowErrorCode(error: unknown): ReportWorkflowError {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code) : '';
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message) : '';
  if (/delivered or pending reports cannot be reopened|delivery history cannot be dismissed|reports entering delivery cannot be dismissed/i.test(message)) return 'sent';
  if (/unresolved attendance conflicts/i.test(message)) return 'attendance';
  if (/Review included Teaching Updates|Approve submitted sources|no submitted Teaching Updates/i.test(message)) return 'sources';
  if (/Report Cycle is already finalized|report batch must be in review|report batch not found|Report Cycle not found/i.test(message)) return 'stale';
  if (code === '42501') return 'permission';
  if (code === '23514' || code === '22023' || code === '23505') return 'rule';
  return 'save';
}
