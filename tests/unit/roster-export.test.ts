import {TextDecoder} from 'node:util';

import {describe, expect, it} from 'vitest';

import {
  buildRosterExportCsv,
  type RosterExportRow
} from '@/features/roster-csv/roster-export.service';

const decoder = new TextDecoder();

const subjects = [
  {id: 'subject-quran', nameEn: 'Quran'},
  {id: 'subject-arabic', nameEn: 'Arabic'}
];

const row: RosterExportRow = {
  studentId: 'student-1',
  firstNameEn: 'Sara',
  lastNameEn: 'Ali',
  firstNameAr: 'سارة',
  lastNameAr: 'علي',
  guardianId: 'guardian-1',
  guardianName: 'Ahmed Ali',
  guardianEmail: 'parent@example.com',
  guardianPhone: '7805550101',
  reportLanguage: 'both',
  classId: 'class-1',
  className: 'Level 1',
  enrollmentStartDate: '2026-09-01',
  groups: {
    'subject-quran': {
      groupId: 'group-quran-a',
      groupName: 'Quran A'
    },
    'subject-arabic': null
  }
};

describe('roster export CSV', () => {
  it('includes stable base identifiers and dynamic Subject Group columns', () => {
    const bytes = buildRosterExportCsv(subjects, [row]);

    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

    const text = decoder.decode(bytes);

    expect(text).toContain(
      [
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
        'Quran group',
        'Quran group_id',
        'Arabic group',
        'Arabic group_id'
      ].join(',')
    );

    expect(text).toContain('student-1');
    expect(text).toContain('guardian-1');
    expect(text).toContain('class-1');
    expect(text).toContain('Quran A');
    expect(text).toContain('group-quran-a');
    expect(text).toContain('سارة');
  });

  it('leaves unattached or ungrouped Subjects blank', () => {
    const text = decoder.decode(
      buildRosterExportCsv(subjects, [row])
    );

    const dataLine = text
      .split('\r\n')
      .find((line) => line.startsWith('student-1'));

    expect(dataLine).toBeDefined();
    expect(dataLine?.endsWith(',,')).toBe(true);
  });

  it('writes one CSV row per Student', () => {
    const bytes = buildRosterExportCsv(subjects, [
      row,
      {
        ...row,
        studentId: 'student-2',
        firstNameEn: 'Omar',
        firstNameAr: 'عمر'
      }
    ]);

    const lines = decoder
      .decode(bytes)
      .split('\r\n')
      .filter(Boolean);

    expect(lines).toHaveLength(3);
  });

  it('protects spreadsheet-formula cells consistently', () => {
    const bytes = buildRosterExportCsv(subjects, [
      {
        ...row,
        guardianName: '=HYPERLINK("bad")'
      }
    ]);

    expect(decoder.decode(bytes)).toContain(
      '\'=HYPERLINK(""bad"")'
    );
  });
});
