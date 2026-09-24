'use server';

import {resolveReportPeriod} from '@/features/reports/report.service';
import {isLocale, type Locale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

import {createExportRequest, getSchoolTimezone} from './export.repository';
import {validateExportRequest, type ExportRequestInput} from './export.service';

type ReportPreset = Parameters<typeof resolveReportPeriod>[0]['preset'];

type ExportPeriodPreset = ReportPreset | 'ALL_HISTORY';

function localeFrom(formData: FormData): Locale {
  const value = String(formData.get('locale') ?? 'en');
  return isLocale(value) ? value : 'en';
}

function localIsoDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function periodFromForm(formData: FormData, today: string) {
  const rawPreset = String(formData.get('periodPreset') ?? 'THIS_MONTH') as ExportPeriodPreset;
  if (rawPreset === 'ALL_HISTORY') return {periodStart: null, periodEnd: null};

  const allowed = new Set<ReportPreset>(['THIS_WEEK', 'LAST_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'CUSTOM']);
  const preset: ReportPreset = allowed.has(rawPreset as ReportPreset) ? rawPreset as ReportPreset : 'THIS_MONTH';
  const period = resolveReportPeriod({
    preset,
    today,
    customStart: String(formData.get('customStart') ?? '') || undefined,
    customEnd: String(formData.get('customEnd') ?? '') || undefined
  });
  return {periodStart: period.start, periodEnd: period.end};
}

function scopeFromForm(formData: FormData): ExportRequestInput['scope'] {
  const type = String(formData.get('scopeType') ?? 'SCHOOL');
  switch (type) {
    case 'CLASS':
      return {type, classId: String(formData.get('classId') ?? '')};
    case 'SUBJECT':
      return {
        type,
        classId: String(formData.get('classId') ?? ''),
        classSubjectId: String(formData.get('classSubjectId') ?? '')
      };
    case 'GROUP':
      return {
        type,
        classId: String(formData.get('classId') ?? ''),
        classSubjectId: String(formData.get('classSubjectId') ?? ''),
        subjectGroupId: String(formData.get('subjectGroupId') ?? '')
      };
    case 'STUDENT':
      return {type, studentId: String(formData.get('studentId') ?? '')};
    case 'TEACHER':
      return {type, teacherId: String(formData.get('teacherId') ?? '')};
    default:
      return {type: 'SCHOOL'};
  }
}

export async function createExportAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireAdministrator(locale);
  const timeZone = await getSchoolTimezone(profile.schoolId);
  const period = periodFromForm(formData, localIsoDate(timeZone));
  const request = validateExportRequest({
    ...period,
    scope: scopeFromForm(formData),
    datasets: formData.getAll('datasets').map(String),
    includeCsv: formData.get('includeCsv') === 'on',
    includeFinalizedReportPdfs: formData.get('includeFinalizedReportPdfs') === 'on'
  });

  const exportId = await createExportRequest({
    schoolId: profile.schoolId,
    requestedByProfileId: profile.id,
    request
  });
  return `/api/exports/${exportId}`;
}
