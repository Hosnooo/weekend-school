'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {databaseUuid} from '@/lib/validation/fields';
import type {ActionState} from '@/lib/validation/action-state';
import {persistenceFailure, saveFailure, validationFailure} from '@/lib/validation/action-state';

const editAdministratorSchema = z.object({
  id: databaseUuid,
  displayName: z.string().trim().min(1).max(120)
});

export async function updateAdministratorDetailsAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const rawLocale = String(formData.get('locale') ?? 'en');
  const locale = isLocale(rawLocale) ? rawLocale : 'en';
  const profile = await requireAdministrator(locale);
  const parsed = editAdministratorSchema.safeParse({
    id: formData.get('id'),
    displayName: formData.get('displayName')
  });
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const db = await createServerSupabaseClient();
    const {data, error} = await db.from('administrators')
      .update({display_name: parsed.data.displayName})
      .eq('school_id', profile.schoolId)
      .eq('id', parsed.data.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Administrator not found');
  } catch (error) {
    console.error('Unable to update Administrator details', {error});
    return error instanceof Error && error.message === 'Administrator not found'
      ? saveFailure('notFound')
      : persistenceFailure(error);
  }

  revalidatePath(`/${locale}/administrators`);
  revalidatePath(`/${locale}/administrators/${parsed.data.id}`);
  redirect(`/${locale}/administrators/${parsed.data.id}`);
}
