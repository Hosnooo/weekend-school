export function buildPermanentDeleteConfirmation(entityName: string) {
  return entityName;
}

export function validatePermanentDeleteRequest(input: {
  entityName: string;
  isArchived: boolean;
  confirmation: string;
}) {
  if (!input.isArchived) {
    throw new Error(
      'Only archived records can be permanently deleted'
    );
  }

  if (
    input.confirmation !==
    buildPermanentDeleteConfirmation(input.entityName)
  ) {
    throw new Error(
      'Permanent deletion confirmation does not match'
    );
  }

  return {
    entityName: input.entityName,
    confirmation: input.confirmation
  };
}
