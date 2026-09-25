'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {databaseUuid} from '@/lib/validation/fields';

const editAdministratorSchema = z.object({
  id: databaseUuid,
  displayName: z.string().trim().min(1).max(120)
});

export async function updateAdministratorDetailsAction(formData: FormData) {
  const rawLocale = String(formData.get('locale') ?? 'en');
  const locale = isLocale(rawLocale) ? rawLocale : 'en';
  const profile = await requireAdministrator(locale);
  const parsed = editAdministratorSchema.safeParse({
    id: formData.get('id'),
    displayName: formData.get('displayName')
  });
  const rawId = String(formData.get('id') ?? '');
  if (!parsed.success) redirect(`/${locale}/administrators/${rawId}/edit?error=validation`);

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
    redirect(`/${locale}/administrators/${parsed.data.id}/edit?error=save`);
  }

  revalidatePath(`/${locale}/administrators`);
  revalidatePath(`/${locale}/administrators/${parsed.data.id}`);
  redirect(`/${locale}/administrators/${parsed.data.id}`);
}
