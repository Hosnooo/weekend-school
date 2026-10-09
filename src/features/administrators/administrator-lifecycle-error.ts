import {persistenceFailure} from '@/lib/validation/action-state';

/** Translate only recognized last-active guard failures into the existing UI code. */
export function administratorLifecycleError(error: unknown) {
  const message = error instanceof Error ? error.message
    : error && typeof error === 'object' && 'message' in error
      ? String(error.message) : '';
  const code = error && typeof error === 'object' && 'code' in error
    ? String(error.code) : '';
  if (/Cannot remove the last active Administrator/i.test(message) &&
      (code === '' || code === 'P0001')) {
    return 'last-admin' as const;
  }
  const reason = persistenceFailure(error).error;
  return reason && reason !== 'validation' ? reason : 'save';
}
