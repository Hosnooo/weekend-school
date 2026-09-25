import 'server-only';

import type {GuardianInput} from '@/features/guardians/guardian.schemas';
import type {
  GuardianDetail,
  GuardianListItem,
  GuardianStudentLink,
  StudentGuardianLink
} from '@/features/guardians/guardian.types';
import {createServerSupabaseClient} from '@/lib/supabase/server';

type GuardianRow = {
  id: string;
  name: string;
  email: string;
  report_language: 'en' | 'ar' | 'both';
  is_active: boolean;
};

type StudentGuardianRow = {
  is_primary: boolean;
  receives_reports: boolean;
  guardians: GuardianRow | null;
};

type GuardianStudentRow = {
  is_primary: boolean;
  receives_reports: boolean;
  students: {
    id: string;
    first_name_en: string;
    last_name_en: string;
    first_name_ar: string | null;
    last_name_ar: string | null;
    is_active: boolean;
  } | null;
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

export async function listStudentGuardians(schoolId: string, studentId: string): Promise<StudentGuardianLink[]> {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('student_guardians')
    .select('is_primary, receives_reports, guardians(id, name, email, report_language, is_active)')
    .eq('school_id', schoolId)
    .eq('student_id', studentId);
  if (error) throw error;

  return (data as unknown as StudentGuardianRow[]).flatMap((row) => row.guardians ? [{
    ...mapGuardian(row.guardians),
    isPrimary: row.is_primary,
    receivesReports: row.receives_reports
  }] : []).sort((left, right) => left.name.localeCompare(right.name));
}

export async function getGuardianDetail(schoolId: string, id: string): Promise<GuardianDetail | null> {
  const [guardian, linksResult] = await Promise.all([
    getGuardian(schoolId, id),
    (async () => {
      const supabase = await createServerSupabaseClient();
      return supabase
        .from('student_guardians')
        .select('is_primary, receives_reports, students(id, first_name_en, last_name_en, first_name_ar, last_name_ar, is_active)')
        .eq('school_id', schoolId)
        .eq('guardian_id', id);
    })()
  ]);
  if (!guardian) return null;
  if (linksResult.error) throw linksResult.error;

  const students: GuardianStudentLink[] = (linksResult.data as unknown as GuardianStudentRow[]).flatMap((row) => row.students ? [{
    id: row.students.id,
    firstNameEn: row.students.first_name_en,
    lastNameEn: row.students.last_name_en,
    firstNameAr: row.students.first_name_ar,
    lastNameAr: row.students.last_name_ar,
    isActive: row.students.is_active,
    isPrimary: row.is_primary,
    receivesReports: row.receives_reports
  }] : []).sort((left, right) => `${left.lastNameEn} ${left.firstNameEn}`.localeCompare(`${right.lastNameEn} ${right.firstNameEn}`));

  return {...guardian, students};
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
