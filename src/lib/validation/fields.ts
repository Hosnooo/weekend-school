import {z} from 'zod';

export const requiredText = z.string().trim().min(1);

export const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().min(1).nullable()
);

export const optionalUuid = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.uuid().nullable()
);

export const normalizedEmail = z.string().trim().toLowerCase().pipe(z.email());
