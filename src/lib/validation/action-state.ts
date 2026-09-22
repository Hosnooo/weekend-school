export type ActionState = {
  status: 'idle' | 'error';
  error: 'validation' | 'save' | 'invite' | 'conflict' | 'transferConflict' | null;
};

export const initialActionState: ActionState = {status: 'idle', error: null};

export function validationFailure(): ActionState {
  return {status: 'error', error: 'validation'};
}

export function saveFailure(error: ActionState['error'] = 'save'): ActionState {
  return {status: 'error', error};
}
