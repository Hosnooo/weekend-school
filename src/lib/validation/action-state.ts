import type {ZodError} from 'zod';
import {validationIssues, type ValidationIssue} from './error-guidance';

export type ActionState = {
  status: 'idle' | 'error';
  error: 'validation' | 'save' | 'invite' | 'conflict' | 'transferConflict' | 'adminAccount' | 'teacherAccount' | 'guardianAlreadyLinked' | 'duplicate' | 'notFound' | 'rule' | 'stale' | 'permission' | 'protectedHistory' | null;
  issues?: ValidationIssue[];
};

export const initialActionState: ActionState = {status: 'idle', error: null};

export function validationFailure(error?: ZodError): ActionState {
  return {status: 'error', error: 'validation', ...(error ? {issues: validationIssues(error)} : {})};
}

export function saveFailure(error: ActionState['error'] = 'save'): ActionState {
  return {status: 'error', error};
}

/** Only known codes are translated. Never disclose raw database errors. */
export function persistenceFailure(error: unknown): ActionState {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code === '23505') return saveFailure('duplicate');
  if (code === '23503') return saveFailure('notFound');
  if (code === '23514' || code === '22023') return saveFailure('rule');
  if (code === '40001' || code === 'P0002') return saveFailure('stale');
  if (code === '42501') return saveFailure('permission');
  return saveFailure();
}
