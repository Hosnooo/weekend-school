import {describe, expect, it} from 'vitest';

import {
  buildRosterImportPreview,
  parseRosterCsv
} from '@/features/roster-csv/roster-csv.service';

const catalog = {
  defaultLanguage: 'en' as const,
  subjects: [
    {id: 'subject-quran', nameEn: 'Quran', nameAr: 'القرآن', isActive: true},
    {id: 'subject-arabic', nameEn: 'Arabic', nameAr: 'العربية', isActive: true}
  ],
  classes: [
    {
      id: 'class-1',
      nameEn: 'Level 1',
      nameAr: 'المستوى الأول',
      isActive: true,
      subjects: [
        {
          id: 'cs-quran',
          subjectId: 'subject-quran',
          nameEn: 'Quran',
          nameAr: 'القرآن',
          isActive: true,
          defaultGroupId: 'group-quran-default',
          groups: [
            {
              id: 'group-quran-default',
              nameEn: 'Group A',
              nameAr: 'المجموعة أ',
              isActive: true
            },
            {
              id: 'group-quran-advanced',
              nameEn: 'Advanced',
              nameAr: 'متقدم',
              isActive: true
            }
          ]
        },
        {
          id: 'cs-arabic',
          subjectId: 'subject-arabic',
          nameEn: 'Arabic',
          nameAr: 'العربية',
          isActive: true,
          defaultGroupId: null,
          groups: [
            {
              id: 'group-arabic-a',
              nameEn: 'Arabic A',
              nameAr: 'العربية أ',
              isActive: true
            }
          ]
        }
      ]
    }
  ],
  guardians: [
    {
      id: 'guardian-existing',
      name: 'Ahmed Ali',
      email: 'parent@example.com',
      phone: '7805550101',
      reportLanguage: 'both' as const,
      isActive: true
    }
  ],
  students: [
    {
      id: 'student-existing',
      firstNameEn: 'Existing',
      lastNameEn: 'Student',
      isActive: true
    }
  ]
};

function csv(...rows: string[]) {
  return parseRosterCsv([
    'student_first_name_en,student_last_name_en,student_first_name_ar,student_last_name_ar,guardian_name,guardian_email,guardian_phone,report_language,class,enrollment_start_date,Quran group,Arabic group',
    ...rows
  ].join('\n'));
}

describe('roster import preview', () => {
  it('resolves an existing Guardian, explicit Group, and ungrouped Subject', () => {
    const preview = buildRosterImportPreview(
      csv(
        'Sara,Ali,سارة,علي,Ahmed Ali, PARENT@EXAMPLE.COM ,7805550101,both, level 1 ,2026-09-01, advanced ,'
      ),
      catalog
    );

    expect(preview.hasErrors).toBe(false);
    expect(preview.rows[0].guardian).toEqual({
      kind: 'REUSE',
      id: 'guardian-existing'
    });
    expect(preview.rows[0].class).toEqual({
      id: 'class-1',
      nameEn: 'Level 1'
    });

    expect(preview.rows[0].groups).toEqual([
      expect.objectContaining({
        subjectNameEn: 'Quran',
        groupId: 'group-quran-advanced',
        groupNameEn: 'Advanced',
        mode: 'EXPLICIT'
      }),
      expect.objectContaining({
        subjectNameEn: 'Arabic',
        groupId: null,
        groupNameEn: null,
        mode: 'UNGROUPED'
      })
    ]);

    expect(preview.rows[0].canonical?.guardianEmail).toBe('parent@example.com');
    expect(preview.rows[0].canonical?.className).toBe('Level 1');
  });

  it('uses a default Group when the Subject Group cell is blank', () => {
    const preview = buildRosterImportPreview(
      csv(
        'Sara,Ali,,,New Guardian,new@example.com,7805550102,en,Level 1,2026-09-01,,'
      ),
      catalog
    );

    const quran = preview.rows[0].groups.find(
      (group) => group.subjectNameEn === 'Quran'
    );

    expect(quran).toEqual(
      expect.objectContaining({
        groupId: 'group-quran-default',
        groupNameEn: 'Group A',
        mode: 'DEFAULT'
      })
    );
  });

  it('defaults blank report language to the school default', () => {
    const preview = buildRosterImportPreview(
      csv(
        'Sara,Ali,,,New Guardian,new@example.com,7805550102,,Level 1,2026-09-01,,'
      ),
      {...catalog, defaultLanguage: 'ar' as const}
    );

    expect(preview.rows[0].canonical?.reportLanguage).toBe('ar');
  });

  it('plans one new Guardian identity for siblings sharing an email', () => {
    const preview = buildRosterImportPreview(
      csv(
        'Sara,Ali,,,Parent Name,family@example.com,7805550103,en,Level 1,2026-09-01,,',
        'Omar,Ali,,,Parent Name,FAMILY@example.com,7805550103,en,Level 1,2026-09-01,,'
      ),
      catalog
    );

    expect(preview.hasErrors).toBe(false);
    expect(preview.summary.guardiansToCreate).toBe(1);
    expect(preview.rows.every((row) => row.guardian.kind === 'CREATE')).toBe(true);
  });

  it('warns about a likely existing Student but never merges by name', () => {
    const preview = buildRosterImportPreview(
      csv(
        'Existing,Student,,,New Guardian,new@example.com,7805550102,en,Level 1,2026-09-01,,'
      ),
      catalog
    );

    expect(preview.hasErrors).toBe(false);
    expect(preview.rows[0].issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'WARNING',
          code: 'LIKELY_DUPLICATE_STUDENT'
        })
      ])
    );
    expect(preview.rows[0].canonical).not.toBeNull();
  });

  it('rejects an inactive Guardian email rather than silently reusing it', () => {
    const preview = buildRosterImportPreview(
      csv(
        'Sara,Ali,,,Old Guardian,old@example.com,7805550104,en,Level 1,2026-09-01,,'
      ),
      {
        ...catalog,
        guardians: [
          ...catalog.guardians,
          {
            id: 'guardian-inactive',
            name: 'Old Guardian',
            email: 'old@example.com',
            phone: '7805550104',
            reportLanguage: 'en' as const,
            isActive: false
          }
        ]
      }
    );

    expect(preview.hasErrors).toBe(true);
    expect(preview.rows[0].issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'ERROR',
          code: 'GUARDIAN_INACTIVE'
        })
      ])
    );
    expect(preview.rows[0].canonical).toBeNull();
  });

  it('rejects a Group belonging to a Subject that is not attached to the selected Class', () => {
    const preview = buildRosterImportPreview(
      csv(
        'Sara,Ali,,,New Guardian,new@example.com,7805550102,en,Level 1,2026-09-01,,Arabic A'
      ),
      {
        ...catalog,
        classes: [
          {
            ...catalog.classes[0],
            subjects: [catalog.classes[0].subjects[0]]
          }
        ]
      }
    );

    expect(preview.hasErrors).toBe(true);
    expect(preview.rows[0].issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'ERROR',
          code: 'SUBJECT_NOT_IN_CLASS'
        })
      ])
    );
  });

  it('rejects ambiguous Class names instead of guessing', () => {
    const preview = buildRosterImportPreview(
      csv(
        'Sara,Ali,,,New Guardian,new@example.com,7805550102,en,Level 1,2026-09-01,,'
      ),
      {
        ...catalog,
        classes: [
          ...catalog.classes,
          {...catalog.classes[0], id: 'class-duplicate'}
        ]
      }
    );

    expect(preview.hasErrors).toBe(true);
    expect(preview.rows[0].issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'ERROR',
          code: 'CLASS_AMBIGUOUS'
        })
      ])
    );
  });

  it('rejects duplicate identical rows inside the same file', () => {
    const row =
      'Sara,Ali,,,New Guardian,new@example.com,7805550102,en,Level 1,2026-09-01,,';

    const preview = buildRosterImportPreview(csv(row, row), catalog);

    expect(preview.hasErrors).toBe(true);
    expect(preview.rows[1].issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'ERROR',
          code: 'DUPLICATE_ROW'
        })
      ])
    );
  });

  it('rejects an unknown Subject Group column', () => {
    const parsed = parseRosterCsv([
      'student_first_name_en,student_last_name_en,guardian_name,guardian_email,guardian_phone,class,enrollment_start_date,Science group',
      'Sara,Ali,New Guardian,new@example.com,7805550102,Level 1,2026-09-01,Blue'
    ].join('\n'));

    const preview = buildRosterImportPreview(parsed, catalog);

    expect(preview.hasErrors).toBe(true);
    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'ERROR',
          code: 'UNKNOWN_COLUMN'
        })
      ])
    );
  });
});

it('plans creation of a missing Class instead of rejecting it', () => {
  const preview = buildRosterImportPreview(
    csv(
      'Sara,Ali,,,New Guardian,new@example.com,7805550102,en,Ages 5–6,2026-09-01,,'
    ),
    catalog
  );

  expect(preview.hasErrors).toBe(false);

  expect(preview.rows[0].class).toEqual({
    kind: 'CREATE',
    nameEn: 'Ages 5–6'
  });

  expect(preview.rows[0].canonical).toEqual(
    expect.objectContaining({
      classId: null,
      className: 'Ages 5–6'
    })
  );

  expect(preview.summary).toEqual(
    expect.objectContaining({
      classesToCreate: 1
    })
  );
});
