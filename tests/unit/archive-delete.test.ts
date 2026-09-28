import {describe, expect, it} from 'vitest';

import {
  buildPermanentDeleteConfirmation,
  validatePermanentDeleteRequest
} from '@/features/archives/archive.service';

describe('archive deletion safety', () => {
  it('requires an archived target and exact record-name confirmation', () => {
    const entityName = 'Sara Ali';
    const confirmation =
      buildPermanentDeleteConfirmation(entityName);

    expect(confirmation).toBe('Sara Ali');

    expect(() =>
      validatePermanentDeleteRequest({
        entityName,
        isArchived: false,
        confirmation
      })
    ).toThrow(/archived/i);

    expect(() =>
      validatePermanentDeleteRequest({
        entityName,
        isArchived: true,
        confirmation: 'Sara'
      })
    ).toThrow(/confirmation/i);

    expect(
      validatePermanentDeleteRequest({
        entityName,
        isArchived: true,
        confirmation
      })
    ).toEqual({
      entityName,
      confirmation
    });
  });
});
