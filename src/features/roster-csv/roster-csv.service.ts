import {parse as parseCsv} from 'csv-parse/sync';

import type {
  CanonicalRosterImportRow,
  ParsedRosterCsv,
  RosterImportCatalog,
  RosterImportPreview,
  RosterImportPreviewRow,
  RosterIssue,
  RosterLanguage,
  RosterPreviewGroup,
  RosterPreviewGuardian,
  RosterSubjectColumn
} from './roster-csv.types';

export const MAX_ROSTER_ROWS = 500;

export const BASE_ROSTER_HEADERS = [
  'student_first_name_en',
  'student_last_name_en',
  'student_first_name_ar',
  'student_last_name_ar',
  'guardian_name',
  'guardian_email',
  'guardian_phone',
  'report_language',
  'class',
  'enrollment_start_date'
] as const;

const REQUIRED_ROSTER_HEADERS = [
  'student_first_name_en',
  'student_last_name_en',
  'guardian_name',
  'guardian_email',
  'guardian_phone',
  'class',
  'enrollment_start_date'
] as const;

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('en');
}

function formulaSafe(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvCell(value: unknown) {
  const text =
    value === null || value === undefined
      ? ''
      : typeof value === 'string'
        ? formulaSafe(value)
        : formulaSafe(String(value));

  return /[",\r\n]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

export function serializeCsv(
  columns: readonly string[],
  rows: readonly Record<string, unknown>[]
): Uint8Array {
  const lines = [
    columns.map(csvCell).join(','),
    ...rows.map((row) =>
      columns.map((column) => csvCell(row[column])).join(',')
    )
  ];

  return new TextEncoder().encode(
    `\uFEFF${lines.join('\r\n')}\r\n`
  );
}

export function buildRosterTemplate(
  subjects: readonly RosterSubjectColumn[]
): Uint8Array {
  return serializeCsv(
    [
      ...BASE_ROSTER_HEADERS,
      ...subjects.map((subject) => `${subject.nameEn} group`)
    ],
    []
  );
}

export function parseRosterCsv(csvText: string): ParsedRosterCsv {
  let records: string[][];

  try {
    records = parseCsv(csvText, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: false
    }) as string[][];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown CSV error';
    throw new Error(`CSV is malformed: ${message}`);
  }

  if (records.length === 0) {
    throw new Error('CSV must contain a header row');
  }

  const headers = records[0]!.map((value) => String(value).trim());
  const dataRows = records.slice(1);

  if (dataRows.length > MAX_ROSTER_ROWS) {
    throw new Error(`CSV may contain at most ${MAX_ROSTER_ROWS} data rows`);
  }

  return {
    headers,
    rows: dataRows.map((record, index) => ({
      rowNumber: index + 2,
      values: Object.fromEntries(
        headers.map((header, columnIndex) => [
          header,
          String(record[columnIndex] ?? '')
        ])
      )
    }))
  };
}

function valueFor(
  values: Record<string, string>,
  wantedHeader: string
) {
  const wanted = normalized(wantedHeader);
  const entry = Object.entries(values).find(
    ([header]) => normalized(header) === wanted
  );

  return entry?.[1]?.trim() ?? '';
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function error(
  issues: RosterIssue[],
  code: string,
  message: string
) {
  issues.push({level: 'ERROR', code, message});
}

function warning(
  issues: RosterIssue[],
  code: string,
  message: string
) {
  issues.push({level: 'WARNING', code, message});
}

function hasRowError(issues: readonly RosterIssue[]) {
  return issues.some((issue) => issue.level === 'ERROR');
}

function rowSignature(
  headers: readonly string[],
  values: Record<string, string>
) {
  return JSON.stringify(
    headers.map((header) => [
      normalized(header),
      String(values[header] ?? '').trim()
    ])
  );
}

export function buildRosterImportPreview(
  parsed: ParsedRosterCsv,
  catalog: RosterImportCatalog
): RosterImportPreview {
  const globalIssues: RosterIssue[] = [];
  const knownBaseHeaders = new Set(
    BASE_ROSTER_HEADERS.map(normalized)
  );

  const activeSubjects = catalog.subjects.filter(
    (subject) => subject.isActive
  );

  const subjectByGroupHeader = new Map(
    activeSubjects.map((subject) => [
      normalized(`${subject.nameEn} group`),
      subject
    ])
  );

  const normalizedHeaders = parsed.headers.map(normalized);

  for (const required of REQUIRED_ROSTER_HEADERS) {
    if (!normalizedHeaders.includes(normalized(required))) {
      error(
        globalIssues,
        'MISSING_COLUMN',
        `Required column "${required}" is missing`
      );
    }
  }

  for (const header of parsed.headers) {
    const key = normalized(header);

    if (
      !knownBaseHeaders.has(key) &&
      !subjectByGroupHeader.has(key)
    ) {
      error(
        globalIssues,
        'UNKNOWN_COLUMN',
        `Unknown CSV column "${header}"`
      );
    }
  }

  const seenRows = new Set<string>();
  const newGuardianEmails = new Set<string>();
  const reusedGuardianIds = new Set<string>();

  const rows: RosterImportPreviewRow[] = parsed.rows.map((row) => {
    const issues: RosterIssue[] = [];
    const signature = rowSignature(parsed.headers, row.values);

    if (seenRows.has(signature)) {
      error(
        issues,
        'DUPLICATE_ROW',
        'This row duplicates an earlier row in the same file'
      );
    } else {
      seenRows.add(signature);
    }

    const firstNameEn = valueFor(
      row.values,
      'student_first_name_en'
    );
    const lastNameEn = valueFor(
      row.values,
      'student_last_name_en'
    );
    const firstNameAr =
      valueFor(row.values, 'student_first_name_ar') || null;
    const lastNameAr =
      valueFor(row.values, 'student_last_name_ar') || null;
    const guardianName = valueFor(
      row.values,
      'guardian_name'
    );
    const guardianEmail = normalized(
      valueFor(row.values, 'guardian_email')
    );
    const guardianPhone = valueFor(
      row.values,
      'guardian_phone'
    );
    const rawLanguage = normalized(
      valueFor(row.values, 'report_language')
    );
    const className = valueFor(row.values, 'class');
    const startsOn = valueFor(
      row.values,
      'enrollment_start_date'
    );

    for (const [field, value] of [
      ['student_first_name_en', firstNameEn],
      ['student_last_name_en', lastNameEn],
      ['guardian_name', guardianName],
      ['guardian_email', guardianEmail],
      ['guardian_phone', guardianPhone],
      ['class', className],
      ['enrollment_start_date', startsOn]
    ] as const) {
      if (!value) {
        error(
          issues,
          'REQUIRED_VALUE',
          `${field} is required`
        );
      }
    }

    if (guardianEmail && !isEmail(guardianEmail)) {
      error(
        issues,
        'INVALID_EMAIL',
        'Guardian email is invalid'
      );
    }

    if (startsOn && !isIsoDate(startsOn)) {
      error(
        issues,
        'INVALID_DATE',
        'Enrollment start date must be YYYY-MM-DD'
      );
    }

    let reportLanguage: RosterLanguage =
      catalog.defaultLanguage;

    if (rawLanguage) {
      if (
        rawLanguage === 'en' ||
        rawLanguage === 'ar' ||
        rawLanguage === 'both'
      ) {
        reportLanguage = rawLanguage;
      } else {
        error(
          issues,
          'INVALID_REPORT_LANGUAGE',
          'Report language must be en, ar, or both'
        );
      }
    }

    const matchingClasses = catalog.classes.filter(
      (item) =>
        item.isActive &&
        normalized(item.nameEn) === normalized(className)
    );

    const inactiveClassMatch = catalog.classes.some(
      (item) =>
        !item.isActive &&
        normalized(item.nameEn) === normalized(className)
    );

    let resolvedClass:
      | (typeof catalog.classes)[number]
      | null = null;

    if (matchingClasses.length > 1) {
      error(
        issues,
        'CLASS_AMBIGUOUS',
        `Class "${className}" matches more than one active Class`
      );
    } else if (matchingClasses.length === 1) {
      resolvedClass = matchingClasses[0]!;
    } else if (inactiveClassMatch) {
      error(
        issues,
        'CLASS_INACTIVE',
        `Class "${className}" is inactive`
      );
    } else if (className) {
      error(
        issues,
        'CLASS_NOT_FOUND',
        `Class "${className}" was not found`
      );
    }

    const matchingGuardians = catalog.guardians.filter(
      (guardian) =>
        normalized(guardian.email) === guardianEmail
    );
    const activeGuardianMatches = matchingGuardians.filter(
      (guardian) => guardian.isActive
    );
    const inactiveGuardianMatches = matchingGuardians.filter(
      (guardian) => !guardian.isActive
    );

    let guardian: RosterPreviewGuardian = {
      kind: 'INVALID'
    };
    let guardianId: string | null = null;

    if (activeGuardianMatches.length > 1) {
      error(
        issues,
        'GUARDIAN_AMBIGUOUS',
        'More than one active Guardian has this email'
      );
    } else if (activeGuardianMatches.length === 1) {
      const existing = activeGuardianMatches[0]!;
      guardian = {kind: 'REUSE', id: existing.id};
      guardianId = existing.id;
      reusedGuardianIds.add(existing.id);

      if (
        guardianName &&
        normalized(existing.name) !== normalized(guardianName)
      ) {
        warning(
          issues,
          'GUARDIAN_NAME_DIFFERS',
          `Existing Guardian name is "${existing.name}"; CSV will not overwrite it`
        );
      }

      if (
        guardianPhone &&
        (existing.phone ?? '').trim() !== guardianPhone
      ) {
        warning(
          issues,
          'GUARDIAN_PHONE_DIFFERS',
          'Existing Guardian phone differs; CSV will not overwrite it'
        );
      }

      if (
        rawLanguage &&
        existing.reportLanguage !== reportLanguage
      ) {
        warning(
          issues,
          'GUARDIAN_LANGUAGE_DIFFERS',
          'Existing Guardian report language differs; CSV will not overwrite it'
        );
      }

      reportLanguage = existing.reportLanguage;
    } else if (inactiveGuardianMatches.length > 0) {
      error(
        issues,
        'GUARDIAN_INACTIVE',
        'This Guardian email belongs to an inactive Guardian'
      );
    } else if (guardianEmail) {
      guardian = {
        kind: 'CREATE',
        email: guardianEmail
      };
      newGuardianEmails.add(guardianEmail);
    }

    const likelyStudent = catalog.students.some(
      (student) =>
        student.isActive &&
        normalized(student.firstNameEn) ===
          normalized(firstNameEn) &&
        normalized(student.lastNameEn) ===
          normalized(lastNameEn)
    );

    if (likelyStudent) {
      warning(
        issues,
        'LIKELY_DUPLICATE_STUDENT',
        'An active Student with the same English name already exists; this row will still create a new Student'
      );
    }

    const groups: RosterPreviewGroup[] = [];

    if (resolvedClass) {
      const attachedSubjectIds = new Set(
        resolvedClass.subjects
          .filter((subject) => subject.isActive)
          .map((subject) => subject.subjectId)
      );

      for (const subject of activeSubjects) {
        const requestedGroup = valueFor(
          row.values,
          `${subject.nameEn} group`
        );

        if (
          requestedGroup &&
          !attachedSubjectIds.has(subject.id)
        ) {
          error(
            issues,
            'SUBJECT_NOT_IN_CLASS',
            `${subject.nameEn} is not attached to ${resolvedClass.nameEn}`
          );
        }
      }

      for (const classSubject of resolvedClass.subjects) {
        if (!classSubject.isActive) continue;

        const requestedGroup = valueFor(
          row.values,
          `${classSubject.nameEn} group`
        );

        if (requestedGroup) {
          const matches = classSubject.groups.filter(
            (group) =>
              group.isActive &&
              normalized(group.nameEn) ===
                normalized(requestedGroup)
          );

          if (matches.length === 0) {
            error(
              issues,
              'GROUP_NOT_FOUND',
              `Group "${requestedGroup}" was not found for ${classSubject.nameEn}`
            );

            groups.push({
              classSubjectId: classSubject.id,
              subjectNameEn: classSubject.nameEn,
              groupId: null,
              groupNameEn: null,
              mode: 'UNGROUPED'
            });
          } else if (matches.length > 1) {
            error(
              issues,
              'GROUP_AMBIGUOUS',
              `Group "${requestedGroup}" is ambiguous for ${classSubject.nameEn}`
            );

            groups.push({
              classSubjectId: classSubject.id,
              subjectNameEn: classSubject.nameEn,
              groupId: null,
              groupNameEn: null,
              mode: 'UNGROUPED'
            });
          } else {
            const match = matches[0]!;
            groups.push({
              classSubjectId: classSubject.id,
              subjectNameEn: classSubject.nameEn,
              groupId: match.id,
              groupNameEn: match.nameEn,
              mode: 'EXPLICIT'
            });
          }

          continue;
        }

        const defaultGroup =
          classSubject.defaultGroupId
            ? classSubject.groups.find(
                (group) =>
                  group.id === classSubject.defaultGroupId &&
                  group.isActive
              ) ?? null
            : null;

        if (defaultGroup) {
          groups.push({
            classSubjectId: classSubject.id,
            subjectNameEn: classSubject.nameEn,
            groupId: defaultGroup.id,
            groupNameEn: defaultGroup.nameEn,
            mode: 'DEFAULT'
          });
        } else {
          groups.push({
            classSubjectId: classSubject.id,
            subjectNameEn: classSubject.nameEn,
            groupId: null,
            groupNameEn: null,
            mode: 'UNGROUPED'
          });
        }
      }
    }

    let canonical: CanonicalRosterImportRow | null = null;

    if (
      !hasRowError(issues) &&
      globalIssues.every((issue) => issue.level !== 'ERROR') &&
      resolvedClass &&
      guardian.kind !== 'INVALID'
    ) {
      canonical = {
        rowNumber: row.rowNumber,
        firstNameEn,
        lastNameEn,
        firstNameAr,
        lastNameAr,
        guardianId,
        guardianName,
        guardianEmail,
        guardianPhone,
        reportLanguage,
        classId: resolvedClass.id,
        startsOn,
        groups: groups.map((group) => ({
          classSubjectId: group.classSubjectId,
          groupId: group.groupId
        }))
      };
    }

    return {
      rowNumber: row.rowNumber,
      studentName: `${firstNameEn} ${lastNameEn}`.trim(),
      guardianEmail,
      guardian,
      class: resolvedClass
        ? {
            id: resolvedClass.id,
            nameEn: resolvedClass.nameEn
          }
        : null,
      groups,
      issues,
      canonical
    };
  });

  const hasErrors =
    globalIssues.some((issue) => issue.level === 'ERROR') ||
    rows.some((row) => hasRowError(row.issues));

  return {
    issues: globalIssues,
    rows,
    hasErrors,
    summary: {
      rows: rows.length,
      guardiansToCreate: newGuardianEmails.size,
      guardiansToReuse: reusedGuardianIds.size
    }
  };
}
