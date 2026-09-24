import 'server-only';

import type {Locale} from '@/i18n/config';
import {createServerSupabaseClient} from '@/lib/supabase/server';

import type {DeleteImpact} from './archive.types';

function localizedStudentName(row: {
  first_name_en: string;
  last_name_en: string;
  first_name_ar: string | null;
  last_name_ar: string | null;
}, locale: Locale) {
  if (locale === 'ar' && row.first_name_ar && row.last_name_ar) {
    return `${row.first_name_ar} ${row.last_name_ar}`;
  }
  return `${row.first_name_en} ${row.last_name_en}`;
}

function assertRpcData<T>(data: T | null, error: {message?: string; code?: string} | null) {
  if (error) throw error;
  if (data === null) throw new Error('Archive operation returned no data');
  return data;
}

export async function getDeleteImpact(entityId: string): Promise<DeleteImpact> {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase.rpc('get_delete_impact', {
    p_entity_type: 'STUDENT',
    p_entity_id: entityId
  });
  return assertRpcData(data as DeleteImpact | null, error);
}

export async function listArchivedStudents(schoolId: string, locale: Locale) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('students')
    .select('id, first_name_en, last_name_en, first_name_ar, last_name_ar')
    .eq('school_id', schoolId)
    .eq('is_active', false)
    .order('last_name_en')
    .order('first_name_en');

  if (error) throw error;

  return Promise.all((data ?? []).map(async (row) => ({
    id: row.id,
    name: localizedStudentName(row, locale),
    impact: await getDeleteImpact(row.id)
  })));
}

export async function restoreArchivedStudent(entityId: string) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.rpc('restore_entity', {
    p_entity_type: 'STUDENT',
    p_entity_id: entityId
  });
  if (error) throw error;
}

export async function permanentlyDeleteArchivedStudent(entityId: string, confirmation: string) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.rpc('permanently_delete_archived_entity', {
    p_entity_type: 'STUDENT',
    p_entity_id: entityId,
    p_confirmation: confirmation
  });
  if (error) throw error;
}
