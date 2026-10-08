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
  lockedSaveErrorLabel
}: {
  children: ReactNode;
  saveAction: (
    formData: FormData
  ) => Promise<
    | {ok: true; studentIds: string[]}
    | {ok: false; reason?: 'sent' | 'unknown'}
  >;
  saveLabel: string;
  cancelLabel: string;
  saveErrorLabel: string;
  lockedSaveErrorLabel: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [error, setError] = useState<'generic' | 'sent' | null>(null);
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
        setError(result.reason === 'sent' ? 'sent' : 'generic');
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
          {error === 'sent' ? lockedSaveErrorLabel : saveErrorLabel}
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
