import 'server-only';

import {createServerSupabaseClient} from '@/lib/supabase/server';

import type {
  CanonicalRosterImportRow,
  RosterImportCatalog,
  RosterImportSummary,
  RosterLanguage
} from './roster-csv.types';

type SchoolRow = {
  default_language: 'en' | 'ar';
};

type SubjectRow = {
  id: string;
  name_en: string;
  name_ar: string | null;
  is_active: boolean;
};

type ClassRow = {
  id: string;
  name_en: string;
  name_ar: string | null;
  is_active: boolean;
  class_subjects: Array<{
    id: string;
    subject_id: string;
    default_group_id: string | null;
    is_active: boolean;
    subjects: {
      id: string;
      name_en: string;
      name_ar: string | null;
      is_active: boolean;
    } | null;
    subject_groups: Array<{
      id: string;
      name_en: string;
      name_ar: string | null;
      is_active: boolean;
    }>;
  }>;
};

type GuardianRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  report_language: RosterLanguage;
  is_active: boolean;
};

type StudentRow = {
  id: string;
  first_name_en: string;
  last_name_en: string;
  is_active: boolean;
};

export async function listRosterImportCatalog(
  schoolId: string
): Promise<RosterImportCatalog> {
  const db = await createServerSupabaseClient();

  const [
    schoolResult,
    subjectsResult,
    classesResult,
    guardiansResult,
    studentsResult
  ] = await Promise.all([
    db
      .from('schools')
      .select('default_language')
      .eq('id', schoolId)
      .single(),

    db
      .from('subjects')
      .select('id, name_en, name_ar, is_active')
      .eq('school_id', schoolId)
      .order('name_en'),

    db
      .from('classes')
      .select(`
        id,
        name_en,
        name_ar,
        is_active,
        class_subjects(
          id,
          subject_id,
          default_group_id,
          is_active,
          subjects(id, name_en, name_ar, is_active),
          subject_groups!subject_groups_class_subject_school_fk(
            id,
            name_en,
            name_ar,
            is_active
          )
        )
      `)
      .eq('school_id', schoolId)
      .order('name_en'),

    db
      .from('guardians')
      .select('id, name, email, phone, report_language, is_active')
      .eq('school_id', schoolId)
      .order('email'),

    db
      .from('students')
      .select('id, first_name_en, last_name_en, is_active')
      .eq('school_id', schoolId)
      .order('last_name_en')
      .order('first_name_en')
  ]);

  if (schoolResult.error) throw schoolResult.error;
  if (subjectsResult.error) throw subjectsResult.error;
  if (classesResult.error) throw classesResult.error;
  if (guardiansResult.error) throw guardiansResult.error;
  if (studentsResult.error) throw studentsResult.error;

  const school = schoolResult.data as SchoolRow;
  const subjects = subjectsResult.data as SubjectRow[];
  const classes = classesResult.data as unknown as ClassRow[];
  const guardians = guardiansResult.data as GuardianRow[];
  const students = studentsResult.data as StudentRow[];

  return {
    defaultLanguage: school.default_language,

    subjects: subjects.map((subject) => ({
      id: subject.id,
      nameEn: subject.name_en,
      nameAr: subject.name_ar,
      isActive: subject.is_active
    })),

    classes: classes.map((classRow) => ({
      id: classRow.id,
      nameEn: classRow.name_en,
      nameAr: classRow.name_ar,
      isActive: classRow.is_active,

      subjects: classRow.class_subjects.flatMap((classSubject) => {
        if (!classSubject.subjects) return [];

        return [{
          id: classSubject.id,
          subjectId: classSubject.subject_id,
          nameEn: classSubject.subjects.name_en,
          nameAr: classSubject.subjects.name_ar,
          isActive:
            classSubject.is_active &&
            classSubject.subjects.is_active,
          defaultGroupId: classSubject.default_group_id,
          groups: classSubject.subject_groups
            .map((group) => ({
              id: group.id,
              nameEn: group.name_en,
              nameAr: group.name_ar,
              isActive: group.is_active
            }))
            .sort((left, right) =>
              left.nameEn.localeCompare(right.nameEn)
            )
        }];
      })
    })),

    guardians: guardians.map((guardian) => ({
      id: guardian.id,
      name: guardian.name,
      email: guardian.email,
      phone: guardian.phone,
      reportLanguage: guardian.report_language,
      isActive: guardian.is_active
    })),

    students: students.map((student) => ({
      id: student.id,
      firstNameEn: student.first_name_en,
      lastNameEn: student.last_name_en,
      isActive: student.is_active
    }))
  };
}

export async function confirmRosterImport(input: {
  importHash: string;
  rows: readonly CanonicalRosterImportRow[];
}): Promise<RosterImportSummary> {
  const db = await createServerSupabaseClient();

  const {data, error} = await db.rpc('import_student_roster', {
    p_import_hash: input.importHash,
    p_rows: input.rows
  });

  if (error) throw error;
  if (!data || typeof data !== 'object') {
    throw new Error('Roster import returned no summary');
  }

  const summary = data as Record<string, unknown>;

  const rowCount = Number(summary.rowCount);
  const studentsCreated = Number(summary.studentsCreated);
  const guardiansCreated = Number(summary.guardiansCreated);
  const guardiansReused = Number(summary.guardiansReused);

  if (
    !Number.isInteger(rowCount) ||
    !Number.isInteger(studentsCreated) ||
    !Number.isInteger(guardiansCreated) ||
    !Number.isInteger(guardiansReused)
  ) {
    throw new Error('Roster import returned an invalid summary');
  }

  return {
    rowCount,
    studentsCreated,
    guardiansCreated,
    guardiansReused
  };
}
