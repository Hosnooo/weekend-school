import 'server-only';

import type {Locale} from '@/i18n/config';
import {createServerSupabaseClient} from '@/lib/supabase/server';

import type {DeleteImpact} from './archive.types';

export type ManagedArchiveEntityType = 'TEACHER' | 'GUARDIAN' | 'CLASS' | 'SUBJECT' | 'GROUP';
export type ManagedArchivedRecord = {
  entityType: ManagedArchiveEntityType;
  id: string;
  name: string;
  impact: {
    entityType: ManagedArchiveEntityType;
    entityId: string;
    isArchived: boolean;
    canPermanentlyDelete: boolean;
    dependencyCount: number;
    dependencies?: Record<string, number>;
  };
};

function localizedStudentName(row: {first_name_en:string;last_name_en:string;first_name_ar:string|null;last_name_ar:string|null}, locale: Locale) {
  if (locale === 'ar' && row.first_name_ar && row.last_name_ar) return `${row.first_name_ar} ${row.last_name_ar}`;
  return `${row.first_name_en} ${row.last_name_en}`;
}

function assertRpcData<T>(data: T | null, error: {message?: string; code?: string} | null) {
  if (error) throw error;
  if (data === null) throw new Error('Archive operation returned no data');
  return data;
}

export async function archiveStudent(entityId: string) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.rpc('archive_entity', {p_entity_type: 'STUDENT', p_entity_id: entityId});
  if (error) throw error;
}

export async function getDeleteImpact(entityId: string): Promise<DeleteImpact> {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase.rpc('get_delete_impact', {p_entity_type: 'STUDENT', p_entity_id: entityId});
  return assertRpcData(data as DeleteImpact | null, error);
}

export async function listArchivedStudents(schoolId: string, locale: Locale) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase.from('students')
    .select('id, first_name_en, last_name_en, first_name_ar, last_name_ar')
    .eq('school_id', schoolId).eq('is_active', false).order('last_name_en').order('first_name_en');
  if (error) throw error;
  return Promise.all((data ?? []).map(async (row) => ({
    id: row.id,
    name: localizedStudentName(row, locale),
    confirmationName: `${row.first_name_en} ${row.last_name_en}`,
    impact: await getDeleteImpact(row.id)
  })));
}

export async function restoreArchivedStudent(entityId: string) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.rpc('restore_entity', {p_entity_type: 'STUDENT', p_entity_id: entityId});
  if (error) throw error;
}

export async function permanentlyDeleteArchivedStudent(entityId: string, confirmation: string) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.rpc('permanently_delete_archived_entity', {p_entity_type: 'STUDENT', p_entity_id: entityId, p_confirmation: confirmation});
  if (error) throw error;
}

export async function archiveManagedEntity(entityType: ManagedArchiveEntityType, entityId: string) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.rpc('archive_entity', {p_entity_type: entityType, p_entity_id: entityId});
  if (error) throw error;
}

export async function restoreManagedEntity(entityType: ManagedArchiveEntityType, entityId: string) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.rpc('restore_entity', {p_entity_type: entityType, p_entity_id: entityId});
  if (error) throw error;
}

export async function permanentlyDeleteManagedEntity(entityType: ManagedArchiveEntityType, entityId: string, confirmation: string) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.rpc('permanently_delete_archived_entity', {p_entity_type: entityType, p_entity_id: entityId, p_confirmation: confirmation});
  if (error) throw error;
}

export async function listManagedArchivedRecords(schoolId: string): Promise<ManagedArchivedRecord[]> {
  const db = await createServerSupabaseClient();
  const [teachers, guardians, classes, subjects, groups] = await Promise.all([
    db.from('teachers').select('id,display_name').eq('school_id', schoolId).eq('is_active', false).order('display_name'),
    db.from('guardians').select('id,name').eq('school_id', schoolId).eq('is_active', false).order('name'),
    db.from('classes').select('id,name_en').eq('school_id', schoolId).eq('is_active', false).order('name_en'),
    db.from('subjects').select('id,name_en').eq('school_id', schoolId).eq('is_active', false).order('name_en'),
    db.from('subject_groups').select('id,name_en').eq('school_id', schoolId).eq('is_active', false).order('name_en')
  ]);
  for (const result of [teachers, guardians, classes, subjects, groups]) if (result.error) throw result.error;

  const records: Array<{entityType: ManagedArchiveEntityType; id: string; name: string}> = [
    ...(teachers.data ?? []).map((row) => ({entityType: 'TEACHER' as const, id: row.id, name: row.display_name})),
    ...(guardians.data ?? []).map((row) => ({entityType: 'GUARDIAN' as const, id: row.id, name: row.name})),
    ...(classes.data ?? []).map((row) => ({entityType: 'CLASS' as const, id: row.id, name: row.name_en})),
    ...(subjects.data ?? []).map((row) => ({entityType: 'SUBJECT' as const, id: row.id, name: row.name_en})),
    ...(groups.data ?? []).map((row) => ({entityType: 'GROUP' as const, id: row.id, name: row.name_en}))
  ];

  return Promise.all(records.map(async (record) => {
    const {data, error} = await db.rpc('get_delete_impact', {p_entity_type: record.entityType, p_entity_id: record.id});
    return {...record, impact: assertRpcData(data as ManagedArchivedRecord['impact'] | null, error)};
  }));
}
