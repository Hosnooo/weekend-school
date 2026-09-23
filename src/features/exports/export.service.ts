export type ExportDataset =
  | 'STUDENTS'
  | 'MEMBERSHIPS'
  | 'ATTENDANCE'
  | 'COMMENTS'
  | 'REPORTS'
  | 'DELIVERIES';

export type ExportScope =
  | {type: 'CLASS'; classId: string}
  | {type: 'SUBJECT'; classId: string; classSubjectId: string}
  | {type: 'GROUP'; classId: string; classSubjectId: string; subjectGroupId: string};

export type ExportRequest = {
  periodStart: string;
  periodEnd: string;
  scope: ExportScope;
  datasets: readonly ExportDataset[];
  includeCsv: boolean;
  includeFinalizedReportPdfs: boolean;
};

export type ExportRequestInput = {
  periodStart: string;
  periodEnd: string;
  scope: {
    type: 'CLASS' | 'SUBJECT' | 'GROUP';
    classId?: string;
    classSubjectId?: string;
    subjectGroupId?: string;
  };
  datasets: readonly string[];
  includeCsv: boolean;
  includeFinalizedReportPdfs: boolean;
};

export type FinalizedReportExportRef = {
  reportId: string;
  studentName: string;
};

export type ExportFilePlan = {
  name: string;
  contentType: string;
  kind: 'XLSX' | 'CSV' | 'PDF';
};

export type ExportPlan = {
  delivery: 'SINGLE' | 'ZIP';
  downloadFilename: string;
  files: ExportFilePlan[];
};

const DATASETS = new Set<ExportDataset>([
  'STUDENTS',
  'MEMBERSHIPS',
  'ATTENDANCE',
  'COMMENTS',
  'REPORTS',
  'DELIVERIES'
]);

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

function requireNonEmpty(value: string | undefined, label: string) {
  if (!value?.trim()) {
    throw new Error(`${label} is required`);
  }

  return value;
}

function validateScope(scope: ExportRequestInput['scope']): ExportScope {
  const classId = requireNonEmpty(scope.classId, 'Class');

  if (scope.type === 'CLASS') {
    return {type: 'CLASS', classId};
  }

  const classSubjectId = requireNonEmpty(scope.classSubjectId, 'Subject');
  if (scope.type === 'SUBJECT') {
    return {type: 'SUBJECT', classId, classSubjectId};
  }

  const subjectGroupId = requireNonEmpty(scope.subjectGroupId, 'Group');
  return {type: 'GROUP', classId, classSubjectId, subjectGroupId};
}

function slugify(value: string) {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'student';
}

export function validateExportRequest(input: ExportRequestInput): ExportRequest {
  if (!isIsoDate(input.periodStart) || !isIsoDate(input.periodEnd) || input.periodStart > input.periodEnd) {
    throw new Error('Export period is invalid');
  }

  if (input.datasets.length === 0) {
    throw new Error('At least one export dataset is required');
  }

  const datasets = input.datasets.map((dataset) => {
    if (!DATASETS.has(dataset as ExportDataset)) {
      throw new Error(`Unsupported export dataset: ${dataset}`);
    }

    return dataset as ExportDataset;
  });

  if (new Set(datasets).size !== datasets.length) {
    throw new Error('Export datasets must not contain duplicates');
  }

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    scope: validateScope(input.scope),
    datasets,
    includeCsv: input.includeCsv,
    includeFinalizedReportPdfs: input.includeFinalizedReportPdfs
  };
}

export function planExportFiles(
  input: ExportRequestInput,
  finalizedReports: readonly FinalizedReportExportRef[]
): ExportPlan {
  const request = validateExportRequest(input);
  const stem = `mce-weekend-school-export-${request.periodStart}-to-${request.periodEnd}`;
  const files: ExportFilePlan[] = [
    {
      name: `${stem}.xlsx`,
      contentType: XLSX_CONTENT_TYPE,
      kind: 'XLSX'
    }
  ];

  if (request.includeCsv) {
    for (const dataset of request.datasets) {
      files.push({
        name: `${dataset.toLowerCase()}.csv`,
        contentType: 'text/csv; charset=utf-8',
        kind: 'CSV'
      });
    }
  }

  if (request.includeFinalizedReportPdfs && request.datasets.includes('REPORTS')) {
    for (const report of finalizedReports) {
      files.push({
        name: `reports/${slugify(report.reportId)}-${slugify(report.studentName)}.pdf`,
        contentType: 'application/pdf',
        kind: 'PDF'
      });
    }
  }

  const delivery = files.length === 1 ? 'SINGLE' : 'ZIP';
  return {
    delivery,
    downloadFilename: delivery === 'ZIP' ? `${stem}.zip` : files[0]!.name,
    files
  };
}

export function authorizeExportDownload(input: {
  actorRole: string;
  actorActive: boolean;
  actorSchoolId: string;
  exportSchoolId: string;
}) {
  if (input.actorRole !== 'ADMIN') {
    throw new Error('Administrator access is required for exports');
  }

  if (!input.actorActive) {
    throw new Error('An active administrator account is required');
  }

  if (input.actorSchoolId !== input.exportSchoolId) {
    throw new Error('Export school does not match the administrator school');
  }

  return true;
}
