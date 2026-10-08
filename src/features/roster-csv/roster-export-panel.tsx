'use client';

import {useState} from 'react';

import {downloadProtectedFile, ProtectedDownloadFailure, type ProtectedDownloadIssue} from '@/features/exports/browser-download';
import type {Locale} from '@/i18n/config';

export type RosterExportClassOption = {
  id: string;
  label: string;
};

export function RosterExportPanel({
  locale,
  classes,
  labels
}: {
  locale: Locale;
  classes: RosterExportClassOption[];
  labels: {
    title: string;
    description: string;
    schoolRoster: string;
    classRosters: string;
    downloadSchool: string;
    downloadClass: string;
    errors: Record<ProtectedDownloadIssue, string>;
  };
}) {
  const [error, setError] = useState<ProtectedDownloadIssue | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function startDownload(href: string) {
    setError(null);
    setPending(href);
    try {
      await downloadProtectedFile(href, 'roster');
    } catch (failure) {
      setError(failure instanceof ProtectedDownloadFailure ? failure.reason : 'unavailable');
    } finally {
      setPending(null);
    }
  }
  return (
    <section className="detail-section roster-export-panel">
      <div>
        <h2>{labels.title}</h2>
        <p>{labels.description}</p>
      </div>

      <div>
        <h3>{labels.schoolRoster}</h3>

        <button
          className="button button-secondary"
          disabled={pending !== null}
          type="button"
          onClick={() => void startDownload(`/api/roster/export?scope=SCHOOL&locale=${locale}`)}
        >
          {labels.downloadSchool}
        </button>
      </div>

      <div>
        <h3>{labels.classRosters}</h3>

        {classes.length === 0 ? (
          <p>{labels.classRosters}</p>
        ) : (
          <div className="action-list">
            {classes.map((classOption) => (
              <button
                className="button button-secondary"
                disabled={pending !== null}
                type="button"
                onClick={() => void startDownload(`/api/roster/export?scope=CLASS&classId=${encodeURIComponent(classOption.id)}&locale=${locale}`)}
                key={classOption.id}
              >
                {labels.downloadClass}: {classOption.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {error ? <p role="alert" aria-live="polite" className="form-error">{labels.errors[error]}</p> : null}
    </section>
  );
}
