'use client';

import type {FormEvent, ReactNode} from 'react';
import {useRef, useState, useTransition} from 'react';

import {saveClassReportReviewWithAttendanceInlineAction} from './class-report-review.actions';

function rememberSavedValues(form: HTMLFormElement) {
  for (const element of Array.from(form.elements)) {
    if (element instanceof HTMLInputElement) {
      if (element.type === 'checkbox' || element.type === 'radio') {
        element.defaultChecked = element.checked;
      } else {
        element.defaultValue = element.value;
      }
      continue;
    }

    if (element instanceof HTMLTextAreaElement) {
      element.defaultValue = element.value;
      continue;
    }

    if (element instanceof HTMLSelectElement) {
      for (const option of Array.from(element.options)) {
        option.defaultSelected = option.selected;
      }
    }
  }
}

function closeEditor() {
  window.location.hash = 'report-edit-closed';
}

export function ReportEditForm({
  children,
  saveLabel,
  cancelLabel,
  saveErrorLabel
}: {
  children: ReactNode;
  saveLabel: string;
  cancelLabel: string;
  saveErrorLabel: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(false);

    startTransition(async () => {
      const result = await saveClassReportReviewWithAttendanceInlineAction(
        formData
      );

      if (!result.ok) {
        setError(true);
        return;
      }

      rememberSavedValues(form);
      closeEditor();
      window.dispatchEvent(
        new CustomEvent('report-cycle:saved', {
          detail: {studentIds: result.studentIds}
        })
      );
    });
  }

  function cancel() {
    formRef.current?.reset();
    setError(false);
    closeEditor();
  }

  return (
    <form className="record-form" onSubmit={submit} ref={formRef}>
      {children}

      {error ? (
        <p className="form-error" role="alert">
          {saveErrorLabel}
        </p>
      ) : null}

      <div className="row-actions">
        <button
          className="button button-primary"
          disabled={pending}
          type="submit"
        >
          {saveLabel}
        </button>
        <button
          className="button button-secondary"
          disabled={pending}
          onClick={cancel}
          type="button"
        >
          {cancelLabel}
        </button>
      </div>
    </form>
  );
}
