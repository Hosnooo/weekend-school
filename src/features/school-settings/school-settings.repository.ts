import 'server-only';

import {createServerSupabaseClient} from '@/lib/supabase/server';

import type {SchoolSettingsInput} from './school-settings.schemas';

export async function getSchoolSettings(schoolId: string) {
  const db = await createServerSupabaseClient();
  const {data, error} = await db.from('schools')
    .select('name_en,name_ar,timezone,default_language')
    .eq('id', schoolId)
    .single();
  if (error) throw error;
  return {nameEn: data.name_en, nameAr: data.name_ar, timezone: data.timezone, defaultLanguage: data.default_language as 'en' | 'ar'};
}

export async function updateSchoolSettings(schoolId: string, input: SchoolSettingsInput) {
  const db = await createServerSupabaseClient();
  const {error} = await db.from('schools')
    .update({name_en: input.nameEn, name_ar: input.nameAr, timezone: input.timezone, default_language: input.defaultLanguage})
    .eq('id', schoolId);
  if (error) throw error;
}
