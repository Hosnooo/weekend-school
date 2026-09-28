import {serializeCsv} from './roster-csv.service';

export type RosterExportSubject = {
  id: string;
  nameEn: string;
};

export type RosterExportRow = {
  studentId: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  guardianId: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  reportLanguage: string | null;
  classId: string;
  className: string;
  enrollmentStartDate: string;
  groups: Record<
    string,
    {
      groupId: string;
      groupName: string;
    } | null
  >;
};

export function buildRosterExportCsv(
  subjects: readonly RosterExportSubject[],
  rows: readonly RosterExportRow[]
): Uint8Array {
  const columns = [
    'student_id',
    'student_first_name_en',
    'student_last_name_en',
    'student_first_name_ar',
    'student_last_name_ar',
    'guardian_id',
    'guardian_name',
    'guardian_email',
    'guardian_phone',
    'report_language',
    'class_id',
    'class',
    'enrollment_start_date',
    ...subjects.flatMap((subject) => [
      `${subject.nameEn} group`,
      `${subject.nameEn} group_id`
    ])
  ];

  const records = rows.map((row) => {
    const record: Record<string, unknown> = {
      student_id: row.studentId,
      student_first_name_en: row.firstNameEn,
      student_last_name_en: row.lastNameEn,
      student_first_name_ar: row.firstNameAr ?? '',
      student_last_name_ar: row.lastNameAr ?? '',
      guardian_id: row.guardianId ?? '',
      guardian_name: row.guardianName ?? '',
      guardian_email: row.guardianEmail ?? '',
      guardian_phone: row.guardianPhone ?? '',
      report_language: row.reportLanguage ?? '',
      class_id: row.classId,
      class: row.className,
      enrollment_start_date: row.enrollmentStartDate
    };

    for (const subject of subjects) {
      const group = row.groups[subject.id] ?? null;
      record[`${subject.nameEn} group`] = group?.groupName ?? '';
      record[`${subject.nameEn} group_id`] = group?.groupId ?? '';
    }

    return record;
  });

  return serializeCsv(columns, records);
}
