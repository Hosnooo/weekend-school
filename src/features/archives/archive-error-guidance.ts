/** Classify archive failures without exposing SQL details or record identifiers. */
export type ArchiveErrorReason = 'confirmation' | 'dependencies' | 'notArchived' | 'permission' | 'stale' | 'delete' | 'restore';

export function archiveErrorReason(error: unknown, operation: 'delete' | 'restore'): ArchiveErrorReason {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message
    : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';

  if (/confirmation/i.test(message) || (code === '22023' && operation === 'delete')) return 'confirmation';
  if (/Only archived records|not archived/i.test(message)) return 'notArchived';
  if (code === '42501') return 'permission';
  if (code === 'P0002') return 'stale';
  if (code === '23503' || code === '23514' || code === '55000') return 'dependencies';
  return operation;
}
