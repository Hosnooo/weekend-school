'use client';

import type {FormEvent, ReactNode} from 'react';
import {useRef, useState} from 'react';
import {useRouter} from 'next/navigation';

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
  saveAction,
  saveLabel,
  cancelLabel,
  saveErrorLabel,
  lockedSaveErrorLabel,
  validationErrorLabel,
  rosterChangedErrorLabel,
  attendanceErrorLabels
}: {
  children: ReactNode;
  saveAction: (
    formData: FormData
  ) => Promise<
    | {ok: true; studentIds: string[]}
    | {ok: false; reason?: 'sent' | 'unknown' | 'validation' | 'rosterChanged' | 'attendanceIncomplete' | 'attendanceInvalid' | 'attendanceExceeds'; studentId?: string}
  >;
  saveLabel: string;
  cancelLabel: string;
  saveErrorLabel: string;
  lockedSaveErrorLabel: string;
  validationErrorLabel: string;
  rosterChangedErrorLabel: string;
  attendanceErrorLabels: Record<'attendanceIncomplete' | 'attendanceInvalid' | 'attendanceExceeds', string>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new window.FormData(form);
    setError(null);
    setSaving(true);

    try {
      const result = await saveAction(formData);

      if (!result.ok) {
        const reason = result.reason ?? 'unknown';
        if (reason === 'sent') setError(lockedSaveErrorLabel);
        else if (reason === 'rosterChanged') setError(rosterChangedErrorLabel);
        else if (reason === 'validation') setError(validationErrorLabel);
        else if (reason in attendanceErrorLabels) {
          const input = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="studentId"]'))
            .find((item) => item.value === result.studentId);
          const student = input?.closest('.record-card')?.querySelector('.record-name')?.textContent?.trim() ?? '';
          setError(attendanceErrorLabels[reason as keyof typeof attendanceErrorLabels].replace('{student}', student));
        } else setError(saveErrorLabel);
        return;
      }

      rememberSavedValues(form);
      closeEditor();
      router.refresh();
      window.dispatchEvent(
        new CustomEvent('report-cycle:saved', {
          detail: {studentIds: result.studentIds}
        })
      );
    } catch {
      setError(saveErrorLabel);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    formRef.current?.reset();
    setError(null);
    closeEditor();
  }

  return (
    <form className="record-form" onSubmit={submit} ref={formRef}>
      {children}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="row-actions">
        <button
          className="button button-primary"
          disabled={saving}
          type="submit"
        >
          {saveLabel}
        </button>
        <button
          className="button button-secondary"
          disabled={saving}
          onClick={cancel}
          type="button"
        >
          {cancelLabel}
        </button>
      </div>
    </form>
  );
}
