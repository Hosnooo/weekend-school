import {describe, expect, it} from 'vitest';

import {
  authorizeExportDownload,
  planExportFiles,
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
        actorRole: 'TEACHER',
        actorActive: true,
        actorSchoolId: 'school-a',
        exportSchoolId: 'school-a'
      })
    ).toThrow(/admin/i);

    expect(() =>
      authorizeExportDownload({
        actorRole: 'ADMIN',
        actorActive: false,
        actorSchoolId: 'school-a',
        exportSchoolId: 'school-a'
      })
    ).toThrow(/active/i);

    expect(() =>
      authorizeExportDownload({
        actorRole: 'ADMIN',
        actorActive: true,
        actorSchoolId: 'school-a',
        exportSchoolId: 'school-b'
      })
    ).toThrow(/school/i);

    expect(
      authorizeExportDownload({
        actorRole: 'ADMIN',
        actorActive: true,
        actorSchoolId: 'school-a',
        exportSchoolId: 'school-a'
      })
    ).toBe(true);
  });
});
