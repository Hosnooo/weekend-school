/**
 * Only user-correctable export selections belong here. Server-side export
 * validation and authorization remain authoritative.
 */
export type ExportFormIssue = 'period' | 'datasets' | 'scope';

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month! - 1 &&
    parsed.getUTCDate() === day;
}

export function validateExportDownloadForm(formData: FormData): ExportFormIssue | null {
  if (formData.get('periodPreset') === 'CUSTOM') {
    const start = String(formData.get('customStart') ?? '');
    const end = String(formData.get('customEnd') ?? '');
    if (!validDate(start) || !validDate(end) || start > end) return 'period';
  }

  if (formData.getAll('datasets').length === 0) return 'datasets';
  const scope = String(formData.get('scopeType') ?? 'SCHOOL');
  const required: Record<string, string[]> = {
    CLASS: ['classId'],
    SUBJECT: ['classId', 'classSubjectId'],
    GROUP: ['classId', 'classSubjectId', 'subjectGroupId'],
    STUDENT: ['studentId'],
    TEACHER: ['teacherId']
  };
  if ((required[scope] ?? []).some((name) => !String(formData.get(name) ?? '').trim())) {
    return 'scope';
  }
  return null;
}
