import 'server-only';

import type {GuardianInput} from '@/features/guardians/guardian.schemas';
import type {GuardianListItem} from '@/features/guardians/guardian.types';
import {createServerSupabaseClient} from '@/lib/supabase/server';

type GuardianRow = {
  id: string;
  name: string;
  email: string;
  report_language: 'en' | 'ar' | 'both';
  is_active: boolean;
};

function mapGuardian(row: GuardianRow): GuardianListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    reportLanguage: row.report_language,
    isActive: row.is_active
  };
}

export async function listGuardians(schoolId: string) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('guardians')
    .select('id, name, email, report_language, is_active')
    .eq('school_id', schoolId)
    .order('name');
  if (error) throw error;
  return (data as GuardianRow[]).map(mapGuardian);
}

export async function getGuardian(schoolId: string, id: string) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('guardians')
    .select('id, name, email, report_language, is_active')
    .eq('school_id', schoolId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapGuardian(data as GuardianRow) : null;
}

export async function createGuardian(schoolId: string, input: GuardianInput) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.from('guardians').insert({
    school_id: schoolId,
    name: input.name,
    email: input.email,
    report_language: input.reportLanguage
  });
  if (error) throw error;
}

export async function updateGuardian(schoolId: string, id: string, input: GuardianInput) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase
    .from('guardians')
    .update({name: input.name, email: input.email, report_language: input.reportLanguage})
    .eq('school_id', schoolId)
    .eq('id', id);
  if (error) throw error;
}

export async function setGuardianActive(schoolId: string, id: string, isActive: boolean) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase
    .from('guardians')
    .update({is_active: isActive})
    .eq('school_id', schoolId)
    .eq('id', id);
  if (error) throw error;
}
