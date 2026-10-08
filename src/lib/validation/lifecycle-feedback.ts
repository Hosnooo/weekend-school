/**
 * Maps safe server-side lifecycle error categories to actionable, localized
 * common messages. Never display raw persistence errors to users.
 */
export function lifecycleErrorKey(reason: string):
  | 'validation' | 'permission' | 'notFound' | 'rule' | 'stale' | 'lifecycleError' {
  if (reason === 'validation') return 'validation';
  if (reason === 'permission') return 'permission';
  if (reason === 'stale') return 'stale';
  if (reason === 'notFound') return 'notFound';
  if (reason === 'dependencies' || reason === 'rule' || reason === 'notArchived') return 'rule';
  return 'lifecycleError';
}
