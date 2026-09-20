'use server';

import {redirect} from 'next/navigation';

import {languagePreferenceSchema} from '@/features/profiles/profile.schemas';
import {createServerSupabaseClient} from '@/lib/supabase/server';

export async function changeLanguageAction(formData: FormData) {
  const parsed = languagePreferenceSchema.safeParse({
    locale: formData.get('locale'),
    pathname: formData.get('pathname')
  });

  if (!parsed.success) {
    redirect('/en/login');
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (user) {
    const {error} = await supabase
      .from('profiles')
      .update({preferred_language: parsed.data.locale})
      .eq('auth_user_id', user.id);

    if (error) {
      console.error('Unable to persist language preference', {code: error.code});
    }
  }

  redirect(`/${parsed.data.locale}${parsed.data.pathname}`);
}
