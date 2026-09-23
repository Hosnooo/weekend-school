import {describe, expect, it} from 'vitest';

import {
  buildPermanentDeleteConfirmation,
  validatePermanentDeleteRequest
} from '@/features/archives/archive.service';

describe('archive deletion safety', () => {
  it('requires an archived target and exact explicit confirmation', () => {
    const entityId = 'e0000000-0000-0000-0000-000000000001';
    const confirmation = buildPermanentDeleteConfirmation(entityId);

    expect(confirmation).toBe(`DELETE ${entityId}`);
    expect(() => validatePermanentDeleteRequest({
      entityId,
      isArchived: false,
      confirmation
    })).toThrow(/archived/i);
    expect(() => validatePermanentDeleteRequest({
      entityId,
      isArchived: true,
      confirmation: 'DELETE something-else'
    })).toThrow(/confirmation/i);
    expect(validatePermanentDeleteRequest({
      entityId,
      isArchived: true,
      confirmation
    })).toEqual({entityId, confirmation});
  });
});
