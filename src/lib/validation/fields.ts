import {z} from 'zod';

export const requiredText = z.string().trim().min(1);

export const databaseUuid = z.string().trim().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
);

export const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().min(1).nullable()
);

export const optionalUuid = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  databaseUuid.nullable()
);

export const normalizedEmail = z.string().trim().toLowerCase().pipe(z.email());
