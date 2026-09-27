import type {ReportPerformance} from './report.types';

export type ReportComposerSource = {
  id: string;
  teacherName: string;
  progressEn: string | null;
  progressAr: string | null;
  performance: ReportPerformance | null;
  commentEn: string | null;
  commentAr: string | null;
};

export type StudentSectionOverride = {
  studentId: string;
  progressEn: string | null;
  progressAr: string | null;
  performance: ReportPerformance | null;
  commentEn: string | null;
  commentAr: string | null;
};

type ApprovedSectionContent = {
  approvedProgressEn: string | null;
  approvedProgressAr: string | null;
  performance: ReportPerformance | null;
  commentEn: string | null;
  commentAr: string | null;
};

export type ReportSectionComposition = {
  shared: ApprovedSectionContent;
  studentOverrides: Record<string, StudentSectionOverride>;
};

type ComposeReportSectionApprovalInput = {
  mode: 'sources' | 'custom';
  sources: ReportComposerSource[];
  selectedSourceIds: string[];
  customProgressEn: string | null;
  customProgressAr: string | null;
  performance: ReportPerformance | null;
  commentEn: string | null;
  commentAr: string | null;
  studentOverrides: StudentSectionOverride[];
};

export type ReportBatchStudentReadiness = {
  studentId: string;
  hasPersonalizedContent: boolean;
  attendanceConflictCount: number;
  missingDataCount: number;
};

export type ReportStudentReviewRow =
  ReportBatchStudentReadiness & {
    studentNameEn: string;
    studentNameAr: string | null;
    presentCount: number;
    absentCount: number;
    performance: ReportPerformance | null;
    commentEn: string | null;
    commentAr: string | null;
  };

export type ReportStudentReviewLabels = {
  title: string;
  help: string;
  student: string;
  attendance: string;
  performance: string;
  comment: string;
  status: string;
  ready: string;
  needsReview: string;
  noComment: string;
  attendanceValue: (present: number, absent: number) => string;
  performanceValue: (performance: ReportPerformance | null) => string;
};

export type ReportBatchReadinessSummary = {
  readyAutomatically: number;
  personalizedComments: number;
  attendanceConflicts: number;
  missingData: number;
};

export type ReportComposerLabels = {
  sources: string;
  useTeacher: (name: string) => string;
  customProgressEn: string;
  customProgressAr: string;
  readiness: string;
  readyAutomatically: string;
  personalizedComments: string;
  attendanceConflicts: string;
  missingData: string;
};

const defaultLabels: ReportComposerLabels = {
  sources: 'Teacher source blocks',
  useTeacher: (name) => `Use ${name}`,
  customProgressEn: 'Custom official progress (English)',
  customProgressAr: 'Custom official progress (Arabic)',
  readiness: 'Report batch readiness',
  readyAutomatically: 'ready automatically',
  personalizedComments: 'personalized comments',
  attendanceConflicts: 'attendance conflicts',
  missingData: 'missing data'
};

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function joinTexts(values: Array<string | null | undefined>) {
  const unique = [...new Set(values.map(clean).filter((value): value is string => value !== null))];
  return unique.length > 0 ? unique.join('\n\n') : null;
}

function appendText(shared: string | null, personalized: string | null | undefined) {
  const extra = clean(personalized);
  if (!extra) return shared;
  return shared ? `${shared}\n\n${extra}` : extra;
}

export function composeReportSectionApproval(
  input: ComposeReportSectionApprovalInput
): ReportSectionComposition {
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const selectedSources = [...new Set(input.selectedSourceIds)]
    .flatMap((id) => {
      const source = sourceById.get(id);
      return source ? [source] : [];
    });

  const approvedProgressEn = input.mode === 'custom'
    ? clean(input.customProgressEn)
    : joinTexts(selectedSources.map(({progressEn}) => progressEn));
  const approvedProgressAr = input.mode === 'custom'
    ? clean(input.customProgressAr)
    : joinTexts(selectedSources.map(({progressAr}) => progressAr));
  const sourcePerformance = selectedSources
    .map(({performance}) => performance)
    .filter((value): value is ReportPerformance => value !== null)
    .at(-1) ?? null;
  const sourceCommentEn = joinTexts(selectedSources.map(({commentEn}) => commentEn));
  const sourceCommentAr = joinTexts(selectedSources.map(({commentAr}) => commentAr));

  return {
    shared: {
      approvedProgressEn,
      approvedProgressAr,
      performance: input.performance ?? sourcePerformance,
      commentEn: clean(input.commentEn) ?? (input.mode === 'sources' ? sourceCommentEn : null),
      commentAr: clean(input.commentAr) ?? (input.mode === 'sources' ? sourceCommentAr : null)
    },
    studentOverrides: Object.fromEntries(
      input.studentOverrides.map((override) => [override.studentId, {...override}])
    )
  };
}

export function resolveStudentSectionApproval(
  composition: ReportSectionComposition,
  studentId: string
): ApprovedSectionContent {
  const override = composition.studentOverrides[studentId];
  if (!override) return {...composition.shared};

  return {
    approvedProgressEn: clean(override.progressEn) ?? composition.shared.approvedProgressEn,
    approvedProgressAr: clean(override.progressAr) ?? composition.shared.approvedProgressAr,
    performance: override.performance ?? composition.shared.performance,
    commentEn: appendText(composition.shared.commentEn, override.commentEn),
    commentAr: appendText(composition.shared.commentAr, override.commentAr)
  };
}

export function summarizeReportBatchReadiness(
  students: ReportBatchStudentReadiness[]
): ReportBatchReadinessSummary {
  return students.reduce<ReportBatchReadinessSummary>(
    (summary, student) => {
      const hasAttendanceConflict = student.attendanceConflictCount > 0;
      const hasMissingData = student.missingDataCount > 0;

      if (!student.hasPersonalizedContent && !hasAttendanceConflict && !hasMissingData) {
        summary.readyAutomatically += 1;
      }
      if (student.hasPersonalizedContent) summary.personalizedComments += 1;
      if (hasAttendanceConflict) summary.attendanceConflicts += 1;
      if (hasMissingData) summary.missingData += 1;

      return summary;
    },
    {readyAutomatically: 0, personalizedComments: 0, attendanceConflicts: 0, missingData: 0}
  );
}

export function ReportBatchSummary({
  students,
  labels = defaultLabels
}: {
  students: ReportBatchStudentReadiness[];
  labels?: ReportComposerLabels;
}) {
  const summary = summarizeReportBatchReadiness(students);

  return (
    <div className="report-batch-summary" aria-label={labels.readiness}>
      <span>{summary.readyAutomatically} {labels.readyAutomatically}</span>
      <span>{summary.personalizedComments} {labels.personalizedComments}</span>
      <span>{summary.attendanceConflicts} {labels.attendanceConflicts}</span>
      <span>{summary.missingData} {labels.missingData}</span>
    </div>
  );
}

export function ReportComposer({
  sources,
  labels = defaultLabels
}: {
  sources: ReportComposerSource[];
  labels?: ReportComposerLabels;
}) {
  return (
    <section className="report-source-section">
      <h3>{labels.sources}</h3>

      <div className="report-source-grid">
        {sources.map((source) => (
          <article className="report-source-card" key={source.id}>
            <strong>{source.teacherName}</strong>

            {source.progressEn ? (
              <p>{source.progressEn}</p>
            ) : null}

            {source.progressAr ? (
              <p dir="rtl">{source.progressAr}</p>
            ) : null}

            {source.performance ? (
              <span className="report-source-performance">
                {source.performance}
              </span>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function ReportStudentReviewTable({
  students,
  locale,
  labels
}: {
  students: ReportStudentReviewRow[];
  locale: 'en' | 'ar';
  labels: ReportStudentReviewLabels;
}) {
  return (
    <section className="report-student-review">
      <div className="section-heading">
        <div>
          <h3>{labels.title}</h3>
          <p>{labels.help}</p>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{labels.student}</th>
              <th>{labels.attendance}</th>
              <th>{labels.performance}</th>
              <th>{labels.comment}</th>
              <th>{labels.status}</th>
            </tr>
          </thead>

          <tbody>
            {students.map((student) => {
              const needsReview =
                student.missingDataCount > 0 ||
                student.attendanceConflictCount > 0;

              const comment =
                locale === 'ar'
                  ? student.commentAr ?? student.commentEn
                  : student.commentEn ?? student.commentAr;

              return (
                <tr key={student.studentId}>
                  <td>
                    <strong>
                      {locale === 'ar' && student.studentNameAr
                        ? student.studentNameAr
                        : student.studentNameEn}
                    </strong>
                  </td>

                  <td>
                    {labels.attendanceValue(
                      student.presentCount,
                      student.absentCount
                    )}
                  </td>

                  <td>
                    {labels.performanceValue(student.performance)}
                  </td>

                  <td>
                    {comment ?? labels.noComment}
                  </td>

                  <td>
                    <span
                      className={
                        needsReview
                          ? 'status-badge status-inactive'
                          : 'status-badge status-active'
                      }
                    >
                      {needsReview
                        ? labels.needsReview
                        : labels.ready}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
