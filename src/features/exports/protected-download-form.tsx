'use client';

import type {FormEvent, ReactNode} from 'react';
import {useState, useTransition} from 'react';

import {validateExportDownloadForm, type ExportFormIssue} from './export-form-validation';

export type ProtectedDownloadAction = (formData: FormData) => Promise<string>;
type ErrorKey = ExportFormIssue | 'generic';

export function ProtectedDownloadForm({
  action,
  className,
  children,
  mode = 'download',
  errorLabels
}: {
  action?: ProtectedDownloadAction;
  className?: string;
  children: ReactNode;
  mode?: 'download' | 'export';
  errorLabels?: Record<ErrorKey, string>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    if (!action) return;
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    if (mode === 'export') {
      const issue = validateExportDownloadForm(formData);
      if (issue) {
        setError(issue);
        return;
      }
    }

    startTransition(async () => {
      try {
        const href = await action(formData);
        // The server provides an internal protected export route, never an
        // arbitrary external download destination.
        if (!href.startsWith('/api/exports/')) throw new Error('Invalid download path');
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.hidden = true;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } catch {
        setError('generic');
      }
    });
  }

  return (
    <form aria-busy={pending || undefined} className={className} onSubmit={action ? submit : undefined}>
      {children}
      {error && errorLabels ? (
        <p className="form-error" role="alert" aria-live="polite">{errorLabels[error]}</p>
      ) : null}
    </form>
  );
}
