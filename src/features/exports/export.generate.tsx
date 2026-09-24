import {join} from 'node:path';

import {Document, Font, Page, StyleSheet, Text, View, renderToBuffer} from '@react-pdf/renderer';
import {strToU8, zipSync} from 'fflate';

import type {ReportLanguage, ReportSnapshot, ReportSnapshotV2} from '@/features/reports/report.types';
import {selectLocalizedText} from '@/features/reports/report.service';

import {
  planExportFiles,
  validateExportRequest,
  type ExportDataset,
  type ExportRequestInput
} from './export.service';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ZIP_CONTENT_TYPE = 'application/zip';
const ARABIC_FONT_PATH = join(
  process.cwd(),
  'node_modules',
  '@fontsource',
  'noto-sans-arabic',
  'files',
  'noto-sans-arabic-arabic-400-normal.woff'
);

Font.register({
  family: 'NotoSansArabic',
  src: ARABIC_FONT_PATH
});
Font.registerHyphenationCallback((word) => [word]);

export type ExportTabularRow = Record<string, unknown>;

export type FinalizedReportExport = {
  reportId: string;
  studentName: string;
  snapshot: ReportSnapshot | ReportSnapshotV2;
};

export type ExportGenerationData = {
  rows: Partial<Record<ExportDataset, readonly ExportTabularRow[]>>;
  finalizedReports: readonly FinalizedReportExport[];
};

export type GeneratedExportArtifact = {
  filename: string;
  contentType: string;
  bytes: Uint8Array;
};

function xmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function formulaSafe(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function cellText(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return formulaSafe(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return formulaSafe(JSON.stringify(value));
}

function csvEscape(value: unknown) {
  const text = cellText(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function columnName(index: number) {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function columnsFor(rows: readonly ExportTabularRow[]) {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) seen.add(key);
  }
  return [...seen];
}

function toCsv(rows: readonly ExportTabularRow[]) {
  const columns = columnsFor(rows);
  if (columns.length === 0) return strToU8('\uFEFF');

  const lines = [
    columns.map(csvEscape).join(','),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))
  ];
  return strToU8(`\uFEFF${lines.join('\r\n')}\r\n`);
}

function worksheetXml(rows: readonly ExportTabularRow[]) {
  const columns = columnsFor(rows);
  const table = columns.length === 0
    ? []
    : [columns, ...rows.map((row) => columns.map((column) => cellText(row[column])))];

  const xmlRows = table.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(value))}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRows}</sheetData></worksheet>`;
}

function buildWorkbook(
  datasets: readonly ExportDataset[],
  rows: ExportGenerationData['rows']
) {
  const sheetNames = datasets.map((dataset) => dataset.slice(0, 31));
  const workbookSheets = sheetNames
    .map((name, index) => `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join('');
  const workbookRels = sheetNames
    .map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
    .join('');
  const sheetOverrides = sheetNames
    .map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join('');

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetOverrides}</Types>`),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}<Relationship Id="rId${sheetNames.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Aptos"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>')
  };

  datasets.forEach((dataset, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheetXml(rows[dataset] ?? []));
  });

  return zipSync(files, {level: 6});
}

function localizedText(
  english: string | null,
  arabic: string | null,
  language: ReportLanguage
) {
  return selectLocalizedText(english, arabic, language).join(' / ');
}

function performanceLabel(value: string | null) {
  if (!value) return 'Not rated / غير مقيّم';
  const labels: Record<string, string> = {
    EXCELLENT: 'Excellent / ممتاز',
    GOOD: 'Good / جيد',
    DEVELOPING: 'Developing / قيد التطور',
    NEEDS_SUPPORT: 'Needs support / يحتاج إلى دعم'
  };
  return labels[value] ?? value;
}

const pdfStyles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: 'NotoSansArabic',
    fontSize: 10,
    lineHeight: 1.45
  },
  header: {marginBottom: 14},
  title: {fontSize: 18, marginBottom: 6},
  meta: {fontSize: 9, marginBottom: 2},
  section: {marginTop: 12, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#cccccc'},
  heading: {fontSize: 13, marginBottom: 5},
  label: {fontSize: 9, marginTop: 4},
  body: {fontSize: 10, marginTop: 2},
  footer: {marginTop: 16, fontSize: 9}
});

function ReportPdf({snapshot}: {snapshot: ReportSnapshot | ReportSnapshotV2}) {
  const language = snapshot.language;
  const student = localizedText(snapshot.student.nameEn, snapshot.student.nameAr, language);
  const school = localizedText(snapshot.school.nameEn, snapshot.school.nameAr, language);

  if (snapshot.version === 2) {
    const className = localizedText(snapshot.class.nameEn, snapshot.class.nameAr, language);
    const intro = localizedText(snapshot.template.introEn, snapshot.template.introAr, language);
    const closing = localizedText(snapshot.template.closingEn, snapshot.template.closingAr, language);
    return (
      <Document title={`Student Report - ${snapshot.student.nameEn}`} author={snapshot.author}>
        <Page size="A4" style={pdfStyles.page}>
          <View style={pdfStyles.header}>
            <Text>{school}</Text>
            <Text style={pdfStyles.title}>Student Report / تقرير الطالب</Text>
            <Text style={pdfStyles.meta}>{student}</Text>
            <Text style={pdfStyles.meta}>Class / الفصل: {className}</Text>
            <Text style={pdfStyles.meta}>Period / الفترة: {snapshot.period.start} - {snapshot.period.end}</Text>
            {intro ? <Text style={pdfStyles.body}>{intro}</Text> : null}
          </View>
          {snapshot.sections.map((section) => {
            const subject = localizedText(section.subjectNameEn, section.subjectNameAr, language);
            const group = localizedText(section.groupNameEn, section.groupNameAr, language);
            const progress = localizedText(section.approvedProgressEn, section.approvedProgressAr, language);
            const comment = localizedText(section.commentEn, section.commentAr, language);
            return (
              <View key={`${section.classSubjectId}:${section.groupNameEn ?? ''}`} style={pdfStyles.section} wrap={false}>
                <Text style={pdfStyles.heading}>{subject}{group ? ` - ${group}` : ''}</Text>
                <Text style={pdfStyles.body}>Attendance / الحضور: {section.attendance.present} present / حاضر, {section.attendance.absent} absent / غائب, {section.attendance.sessions} sessions / حصص</Text>
                <Text style={pdfStyles.label}>Progress / التقدم</Text>
                <Text style={pdfStyles.body}>{progress || '—'}</Text>
                <Text style={pdfStyles.label}>Performance / الأداء</Text>
                <Text style={pdfStyles.body}>{performanceLabel(section.performance)}</Text>
                {comment ? <><Text style={pdfStyles.label}>Comments / التعليقات</Text><Text style={pdfStyles.body}>{comment}</Text></> : null}
              </View>
            );
          })}
          <View style={pdfStyles.footer}>
            {closing ? <Text>{closing}</Text> : null}
            <Text>Source / المصدر: {snapshot.author}</Text>
          </View>
        </Page>
      </Document>
    );
  }

  return (
    <Document title={`Student Report - ${snapshot.student.nameEn}`} author="MCE Weekend School">
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text>{school}</Text>
          <Text style={pdfStyles.title}>Student Report / تقرير الطالب</Text>
          <Text style={pdfStyles.meta}>{student}</Text>
          <Text style={pdfStyles.meta}>Period / الفترة: {snapshot.period.start} - {snapshot.period.end}</Text>
        </View>
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.heading}>Attendance / الحضور</Text>
          <Text style={pdfStyles.body}>{snapshot.attendance.present} present, {snapshot.attendance.absent} absent, {snapshot.attendance.sessions} sessions</Text>
        </View>
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.heading}>Progress / التقدم</Text>
          {snapshot.progress.map((item) => (
            <Text key={`${item.sessionDate}:${item.groupNameEn}`} style={pdfStyles.body}>{item.sessionDate}: {localizedText(item.textEn, item.textAr, language)}</Text>
          ))}
        </View>
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.heading}>Performance / الأداء</Text>
          <Text style={pdfStyles.body}>{performanceLabel(snapshot.currentPerformance)}</Text>
        </View>
      </Page>
    </Document>
  );
}

async function buildReportPdf(snapshot: ReportSnapshot | ReportSnapshotV2) {
  const buffer = await renderToBuffer(<ReportPdf snapshot={snapshot}/>);
  return new Uint8Array(buffer);
}

export async function generateExportArtifact(
  input: ExportRequestInput,
  data: ExportGenerationData
): Promise<GeneratedExportArtifact> {
  const request = validateExportRequest(input);
  const plan = planExportFiles(
    request,
    data.finalizedReports.map(({reportId, studentName}) => ({reportId, studentName}))
  );

  const workbook = buildWorkbook(request.datasets, data.rows);
  if (plan.delivery === 'SINGLE') {
    return {
      filename: plan.downloadFilename,
      contentType: XLSX_CONTENT_TYPE,
      bytes: workbook
    };
  }

  const generated: Record<string, Uint8Array> = {
    [plan.files[0]!.name]: workbook
  };

  if (request.includeCsv) {
    for (const dataset of request.datasets) {
      generated[`${dataset.toLowerCase()}.csv`] = toCsv(data.rows[dataset] ?? []);
    }
  }

  if (request.includeFinalizedReportPdfs && request.datasets.includes('REPORTS')) {
    const pdfPlans = plan.files.filter((file) => file.kind === 'PDF');
    for (let index = 0; index < data.finalizedReports.length; index += 1) {
      const report = data.finalizedReports[index];
      const file = pdfPlans[index];
      if (!report || !file) continue;
      generated[file.name] = await buildReportPdf(report.snapshot);
    }
  }

  return {
    filename: plan.downloadFilename,
    contentType: ZIP_CONTENT_TYPE,
    bytes: zipSync(generated, {level: 6})
  };
}
