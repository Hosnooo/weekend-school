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
    selectStudent: string;
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
    const refresh = () => loadPreview(selectedStudentId);
    window.addEventListener('report-cycle:saved', refresh);
    return () => window.removeEventListener('report-cycle:saved', refresh);
  }, [loadPreview, selectedStudentId]);

  return (
    <section className="stack report-email-review-panel">
      <div>
        <h3>{labels.emailReview}</h3>
      </div>

      {students.length > 0 ? (
        <label>
          {labels.selectStudent}
          <select
            disabled={pending}
            onChange={(event) => {
              const studentId = event.target.value;
              setSelectedStudentId(studentId);
              loadPreview(studentId);
            }}
            value={selectedStudentId}
          >
            {students.map((student) => (
              <option key={student.studentId} value={student.studentId}>
                {student.studentName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {failed ? (
        <p className="form-error" role="alert">
          {labels.previewUnavailable}
        </p>
      ) : null}

      {preview ? (
        <section className="stack" aria-busy={pending}>
          <p className="record-meta">
            <strong>{labels.parentEmailTo}:</strong>{' '}
            {preview.recipients.length > 0
              ? preview.recipients.join(', ')
              : '—'}
          </p>
          <p className="record-meta">
            <strong>{labels.parentEmailSubject}:</strong>{' '}
            {preview.subject}
          </p>
          <ReportPreviewFrame
            html={preview.html}
            title={labels.emailReview}
          />
        </section>
      ) : null}
    </section>
  );
}
