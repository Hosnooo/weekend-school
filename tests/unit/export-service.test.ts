import {describe, expect, it} from 'vitest';

import {
  authorizeExportDownload,
  authorizeStoredExportDownload,
  planExportFiles,
  recordMatchesExportRequest,
  validateExportRequest
} from '@/features/exports/export.service';

const request = {
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  scope: {type: 'CLASS' as const, classId: 'class-5'},
  datasets: ['STUDENTS', 'ATTENDANCE', 'REPORTS'] as const,
  includeCsv: true,
  includeFinalizedReportPdfs: true
};

describe('protected exports', () => {
  it('validates period, scope, and selected datasets before generation', () => {
    expect(validateExportRequest(request)).toEqual(request);

    expect(() => validateExportRequest({...request, periodStart: '2026-10-01'})).toThrow(/period/i);
    expect(() => validateExportRequest({...request, datasets: []})).toThrow(/dataset/i);
    expect(() =>
      validateExportRequest({
        ...request,
        scope: {type: 'GROUP', classId: 'class-5', classSubjectId: 'quran'}
      })
    ).toThrow(/group/i);
  });

  it('supports school, student, teacher, and all-history export requests', () => {
    expect(validateExportRequest({
      ...request,
      periodStart: null,
      periodEnd: null,
      scope: {type: 'SCHOOL'}
    })).toMatchObject({periodStart: null, periodEnd: null, scope: {type: 'SCHOOL'}});

    expect(validateExportRequest({
      ...request,
      scope: {type: 'STUDENT', studentId: 'student-1'}
    }).scope).toEqual({type: 'STUDENT', studentId: 'student-1'});

    expect(validateExportRequest({
      ...request,
      scope: {type: 'TEACHER', teacherId: 'teacher-1'}
    }).scope).toEqual({type: 'TEACHER', teacherId: 'teacher-1'});
  });

  it('filters student and teacher exports without leaking unrelated rows', () => {
    const studentRequest = validateExportRequest({
      ...request,
      scope: {type: 'STUDENT', studentId: 'student-1'}
    });
    expect(recordMatchesExportRequest({studentId: 'student-1', occurredOn: '2026-09-12'}, studentRequest)).toBe(true);
    expect(recordMatchesExportRequest({studentId: 'student-2', occurredOn: '2026-09-12'}, studentRequest)).toBe(false);

    const teacherRequest = validateExportRequest({
      ...request,
      scope: {type: 'TEACHER', teacherId: 'teacher-1'}
    });
    expect(recordMatchesExportRequest({teacherId: 'teacher-1', occurredOn: '2026-09-12'}, teacherRequest)).toBe(true);
    expect(recordMatchesExportRequest({teacherId: 'teacher-2', occurredOn: '2026-09-12'}, teacherRequest)).toBe(false);
    expect(recordMatchesExportRequest({studentId: 'student-1', occurredOn: '2026-09-12'}, teacherRequest)).toBe(false);
  });

  it('always plans an XLSX workbook, adds optional CSV/PDF files, and ZIPs multiple files', () => {
    const result = planExportFiles(request, [
      {reportId: 'report-1', studentName: 'Amina Hassan'},
      {reportId: 'report-2', studentName: 'Yusuf Ali'}
    ]);

    expect(result.delivery).toBe('ZIP');
    expect(result.downloadFilename).toBe('mce-weekend-school-export-2026-09-01-to-2026-09-30.zip');
    expect(result.files.map((file) => file.name)).toEqual([
      'mce-weekend-school-export-2026-09-01-to-2026-09-30.xlsx',
      'students.csv',
      'attendance.csv',
      'reports.csv',
      'reports/report-1-amina-hassan.pdf',
      'reports/report-2-yusuf-ali.pdf'
    ]);
    expect(result).not.toHaveProperty('publicUrl');
  });

  it('returns a direct XLSX download when the workbook is the only selected file', () => {
    const result = planExportFiles(
      {...request, includeCsv: false, includeFinalizedReportPdfs: false},
      []
    );

    expect(result.delivery).toBe('SINGLE');
    expect(result.downloadFilename).toMatch(/\.xlsx$/);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });

  it('permits temporary downloads only for an active admin in the owning school', () => {
    expect(() =>
      authorizeExportDownload({
        actorIsAdministrator: false,
        actorActive: true,
        actorSchoolId: 'school-a',
        exportSchoolId: 'school-a'
      })
    ).toThrow(/admin/i);

    expect(() =>
      authorizeExportDownload({
        actorIsAdministrator: true,
        actorActive: false,
        actorSchoolId: 'school-a',
        exportSchoolId: 'school-a'
      })
    ).toThrow(/active/i);

    expect(() =>
      authorizeExportDownload({
        actorIsAdministrator: true,
        actorActive: true,
        actorSchoolId: 'school-a',
        exportSchoolId: 'school-b'
      })
    ).toThrow(/school/i);

    expect(
      authorizeExportDownload({
        actorIsAdministrator: true,
        actorActive: true,
        actorSchoolId: 'school-a',
        exportSchoolId: 'school-a'
      })
    ).toBe(true);
  });

  it('rejects expired stored export requests even for the owning admin', () => {
    expect(() => authorizeStoredExportDownload({
      actorIsAdministrator: true,
      actorActive: true,
      actorSchoolId: 'school-a',
      exportSchoolId: 'school-a',
      expiresAt: '2026-09-23T20:00:00.000Z',
      now: '2026-09-23T20:00:01.000Z'
    })).toThrow(/expired/i);

    expect(authorizeStoredExportDownload({
      actorIsAdministrator: true,
      actorActive: true,
      actorSchoolId: 'school-a',
      exportSchoolId: 'school-a',
      expiresAt: '2026-09-23T20:15:00.000Z',
      now: '2026-09-23T20:00:00.000Z'
    })).toBe(true);
  });
});
