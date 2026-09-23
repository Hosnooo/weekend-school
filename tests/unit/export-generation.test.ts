import {strFromU8, unzipSync} from 'fflate';
import {describe, expect, it} from 'vitest';

import {generateExportArtifact} from '@/features/exports/export.generate';
import type {ReportSnapshotV2} from '@/features/reports/report.types';

const request = {
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  scope: {type: 'CLASS' as const, classId: 'class-5'},
  datasets: ['STUDENTS', 'ATTENDANCE', 'REPORTS'] as const,
  includeCsv: true,
  includeFinalizedReportPdfs: true
};

const snapshot: ReportSnapshotV2 = {
  version: 2,
  school: {nameEn: 'MCE Weekend School', nameAr: 'مدرسة إم سي إي لعطلة نهاية الأسبوع'},
  student: {id: 'student-1', nameEn: 'Amina Hassan', nameAr: 'أمينة حسن'},
  class: {id: 'class-5', nameEn: 'Class 5', nameAr: 'الصف الخامس'},
  period: {start: '2026-09-01', end: '2026-09-30'},
  language: 'both',
  sections: [
    {
      classSubjectId: 'quran',
      subjectNameEn: 'Quran',
      subjectNameAr: 'القرآن',
      groupNameEn: 'Group A',
      groupNameAr: 'المجموعة أ',
      approvedProgressEn: 'Reviewed Surah Al-Fatiha.',
      approvedProgressAr: 'تمت مراجعة سورة الفاتحة.',
      performance: 'GOOD',
      attendance: {present: 3, absent: 1, sessions: 4},
      commentEn: 'Good participation.',
      commentAr: 'مشاركة جيدة.'
    }
  ],
  template: {
    introEn: 'September progress report.',
    introAr: 'تقرير التقدم لشهر سبتمبر.',
    closingEn: 'Thank you.',
    closingAr: 'شكراً لكم.'
  },
  author: 'MCE Weekend School',
  generatedAt: '2026-09-30T18:00:00.000Z'
};

const data = {
  rows: {
    STUDENTS: [
      {studentId: 'student-1', nameEn: 'Amina Hassan', nameAr: 'أمينة حسن'}
    ],
    ATTENDANCE: [
      {date: '2026-09-07', studentId: 'student-1', status: 'PRESENT'}
    ],
    REPORTS: [
      {reportId: 'report-1', studentId: 'student-1', revision: 1}
    ]
  },
  finalizedReports: [
    {reportId: 'report-1', studentName: 'Amina Hassan', snapshot}
  ]
};

describe('export artifact generation', () => {
  it('generates a ZIP containing a real workbook, UTF-8 CSVs, and finalized report PDFs', async () => {
    const artifact = await generateExportArtifact(request, data);

    expect(artifact.filename).toBe('mce-weekend-school-export-2026-09-01-to-2026-09-30.zip');
    expect(artifact.contentType).toBe('application/zip');

    const entries = unzipSync(artifact.bytes);
    const workbookName = 'mce-weekend-school-export-2026-09-01-to-2026-09-30.xlsx';
    expect(Object.keys(entries).sort()).toEqual([
      'attendance.csv',
      workbookName,
      'reports.csv',
      'reports/report-1-amina-hassan.pdf',
      'students.csv'
    ].sort());

    const workbook = unzipSync(entries[workbookName]!);
    expect(workbook['[Content_Types].xml']).toBeDefined();
    expect(strFromU8(workbook['xl/workbook.xml']!)).toContain('name="STUDENTS"');
    expect(strFromU8(workbook['xl/workbook.xml']!)).toContain('name="ATTENDANCE"');
    expect(strFromU8(entries['students.csv']!)).toContain('أمينة حسن');

    const pdf = entries['reports/report-1-amina-hassan.pdf']!;
    expect(strFromU8(pdf.slice(0, 5))).toBe('%PDF-');
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it('returns a directly downloadable XLSX when no extra files are selected', async () => {
    const artifact = await generateExportArtifact(
      {...request, includeCsv: false, includeFinalizedReportPdfs: false},
      {...data, finalizedReports: []}
    );

    expect(artifact.filename).toMatch(/\.xlsx$/);
    expect(artifact.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    const workbook = unzipSync(artifact.bytes);
    expect(workbook['xl/workbook.xml']).toBeDefined();
    expect(workbook['xl/worksheets/sheet1.xml']).toBeDefined();
  });
});
