export function buildPermanentDeleteConfirmation(entityId: string) {
  return `DELETE ${entityId}`;
}

export function validatePermanentDeleteRequest(input: {
  entityId: string;
  isArchived: boolean;
  confirmation: string;
}) {
  if (!input.isArchived) {
    throw new Error('Only archived records can be permanently deleted');
  }

  if (input.confirmation !== buildPermanentDeleteConfirmation(input.entityId)) {
    throw new Error('Permanent deletion confirmation does not match');
  }

  return {entityId: input.entityId, confirmation: input.confirmation};
}
