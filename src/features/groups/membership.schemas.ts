import {z} from 'zod';

import {databaseUuid, optionalText} from '@/lib/validation/fields';

export const membershipSchema = z
  .object({
    groupId: databaseUuid,
    studentId: databaseUuid,
    startsOn: z.iso.date(),
    endsOn: optionalText.pipe(z.iso.date().nullable())
  })
  .refine(
    ({startsOn, endsOn}) => endsOn === null || endsOn >= startsOn,
    {message: 'End date must be on or after the start date', path: ['endsOn']}
  );

export type MembershipInput = z.infer<typeof membershipSchema>;
