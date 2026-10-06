'use client';

import {useCallback, useEffect, useState, useTransition} from 'react';

import {ReportPreviewFrame} from './report-preview-frame';

export type ReportEmailPreview = {
  studentId: string;
  recipients: string[];
  subject: string;
  html: string;
};

export function ReportEmailReview({
  batchId,
  locale,
  students,
  initialStudentId,
  initialPreview,
  initialFailed = false,
  labels,
  loadPreviewAction
}: {
  batchId: string;
  locale: string;
  students: Array<{studentId: string; studentName: string}>;
  initialStudentId: string;
  initialPreview: ReportEmailPreview | null;
  initialFailed?: boolean;
  labels: {
    emailReview: string;
    emailBody: string;
    selectStudent: string;
    selectStudentPlaceholder: string;
    previewUnavailable: string;
    parentEmailTo: string;
    parentEmailSubject: string;
  };
  loadPreviewAction: (input: {
    batchId: string;
    locale: string;
    studentId: string;
  }) => Promise<
    | {ok: true; preview: ReportEmailPreview}
    | {ok: false}
  >;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId);
  const [preview, setPreview] = useState(initialPreview);
  const [failed, setFailed] = useState(initialFailed);
  const [pending, startTransition] = useTransition();

  const loadPreview = useCallback((studentId: string) => {
    setFailed(false);
    startTransition(async () => {
      const result = await loadPreviewAction({
        batchId,
        locale,
        studentId
      });

      if (!result.ok) {
        setFailed(true);
        return;
      }

      setPreview(result.preview);
    });
  }, [batchId, loadPreviewAction, locale]);

  useEffect(() => {
    const refresh = () => {
      if (selectedStudentId) loadPreview(selectedStudentId);
    };
    window.addEventListener('report-cycle:saved', refresh);
    return () => window.removeEventListener('report-cycle:saved', refresh);
  }, [loadPreview, selectedStudentId]);

  return (
    <section className="detail-section report-email-review-panel">
      <div className="section-heading">
        <div>
          <h2>{labels.emailReview}</h2>
        </div>
      </div>

      <div className="report-email-review-controls">
        <label>
          {labels.selectStudent}
          <select
            disabled={pending}
            onChange={(event) => {
              const studentId = event.target.value;
              setSelectedStudentId(studentId);
              setPreview(null);
              setFailed(false);
              if (studentId) loadPreview(studentId);
            }}
            value={selectedStudentId}
          >
            <option value="">{labels.selectStudentPlaceholder}</option>
            {students.map((student) => (
              <option key={student.studentId} value={student.studentId}>
                {student.studentName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {failed ? (
        <p className="form-error" role="alert">
          {labels.previewUnavailable}
        </p>
      ) : null}

      {preview ? (
        <div className="report-email-review-content" aria-busy={pending}>
          <dl className="report-email-review-meta">
            <div>
              <dt>{labels.parentEmailTo}</dt>
              <dd>
                {preview.recipients.length > 0
                  ? preview.recipients.join(', ')
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>{labels.parentEmailSubject}</dt>
              <dd>{preview.subject}</dd>
            </div>
          </dl>

          <section className="report-email-review-body">
            <h3>{labels.emailBody}</h3>
            <ReportPreviewFrame
              html={preview.html}
              title={labels.emailReview}
            />
          </section>
        </div>
      ) : null}
    </section>
  );
}
