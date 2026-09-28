'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import type {Locale} from '@/i18n/config';

import {
  confirmRosterImportAction,
  initialRosterImportState,
  previewRosterImportAction
} from './roster-csv.actions';
import type {
  RosterImportPreview,
  RosterIssue
} from './roster-csv.types';

const issueKeys: Record<string, string> = {
  MISSING_COLUMN: 'issues.MISSING_COLUMN',
  UNKNOWN_COLUMN: 'issues.UNKNOWN_COLUMN',
  DUPLICATE_ROW: 'issues.DUPLICATE_ROW',
  REQUIRED_VALUE: 'issues.REQUIRED_VALUE',
  INVALID_EMAIL: 'issues.INVALID_EMAIL',
  INVALID_DATE: 'issues.INVALID_DATE',
  INVALID_REPORT_LANGUAGE: 'issues.INVALID_REPORT_LANGUAGE',
  CLASS_AMBIGUOUS: 'issues.CLASS_AMBIGUOUS',
  CLASS_INACTIVE: 'issues.CLASS_INACTIVE',
  CLASS_NOT_FOUND: 'issues.CLASS_NOT_FOUND',
  GUARDIAN_AMBIGUOUS: 'issues.GUARDIAN_AMBIGUOUS',
  GUARDIAN_NAME_DIFFERS: 'issues.GUARDIAN_NAME_DIFFERS',
  GUARDIAN_PHONE_DIFFERS: 'issues.GUARDIAN_PHONE_DIFFERS',
  GUARDIAN_LANGUAGE_DIFFERS: 'issues.GUARDIAN_LANGUAGE_DIFFERS',
  GUARDIAN_INACTIVE: 'issues.GUARDIAN_INACTIVE',
  LIKELY_DUPLICATE_STUDENT: 'issues.LIKELY_DUPLICATE_STUDENT',
  SUBJECT_NOT_IN_CLASS: 'issues.SUBJECT_NOT_IN_CLASS',
  GROUP_NOT_FOUND: 'issues.GROUP_NOT_FOUND',
  GROUP_AMBIGUOUS: 'issues.GROUP_AMBIGUOUS'
};

export function RosterImportForm({
  locale,
  subjectNames
}: {
  locale: Locale;
  subjectNames: string[];
}) {
  const t = useTranslations('students.import');

  const [previewState, previewAction, previewPending] = useActionState(
    previewRosterImportAction,
    initialRosterImportState
  );

  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmRosterImportAction,
    initialRosterImportState
  );

  const confirmationHasResult =
    confirmState.status !== 'idle';

  const activeState = confirmationHasResult
    ? confirmState
    : previewState;

  const preview = activeState.preview;
  const sourceRows =
    activeState.sourceRows ??
    previewState.sourceRows;

  const issueLabel = (issue: RosterIssue) => {
    const key = issueKeys[issue.code] ?? 'issues.UNKNOWN';
    return t(key);
  };

  const guardianLabel = (
    row: RosterImportPreview['rows'][number]
  ) => {
    if (row.guardian.kind === 'REUSE') {
      return t('reuseGuardian');
    }
    if (row.guardian.kind === 'CREATE') {
      return t('createGuardian');
    }
    return t('invalid');
  };

  return (
    <div className="record-form">
      <section>
        <h2>{t('instructionsTitle')}</h2>
        <p>{t('instructions')}</p>

        {subjectNames.length > 0 ? (
          <p>
            <strong>{t('subjects')}:</strong>{' '}
            {subjectNames.join(', ')}
          </p>
        ) : null}

        <a
          className="button button-secondary action-link"
          href={`/api/roster/template?locale=${locale}`}
        >
          {t('downloadTemplate')}
        </a>
      </section>

      <form
        action={previewAction}
        className="record-form"
        encType="multipart/form-data"
      >
        <input name="locale" type="hidden" value={locale} />

        <label>
          {t('fileLabel')}
          <input
            accept=".csv,text/csv"
            name="file"
            required
            type="file"
          />
        </label>

        <p className="field-help">
          {t('fileHelp')}
        </p>

        <Button disabled={previewPending} type="submit">
          {previewPending
            ? t('previewing')
            : t('previewAction')}
        </Button>
      </form>

      {activeState.error ? (
        <p className="form-error" role="alert">
          {t(`errors.${activeState.error}`)}
        </p>
      ) : null}

      {confirmState.status === 'success' && confirmState.summary ? (
        <section className="success-message">
          <h2>{t('successTitle')}</h2>
          <p>
            {t('successSummary', {
              students: confirmState.summary.studentsCreated,
              created: confirmState.summary.guardiansCreated,
              reused: confirmState.summary.guardiansReused
            })}
          </p>
        </section>
      ) : null}

      {preview ? (
        <PreviewTable
          guardianLabel={guardianLabel}
          issueLabel={issueLabel}
          preview={preview}
          t={t}
        />
      ) : null}

      {preview && sourceRows ? (
        <form action={confirmAction}>
          <input name="locale" type="hidden" value={locale} />
          <input
            name="sourceRows"
            type="hidden"
            value={sourceRows}
          />

          <Button
            disabled={
              preview.hasErrors ||
              confirmPending
            }
            type="submit"
          >
            {confirmPending
              ? t('confirming')
              : t('confirmAction')}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function PreviewTable({
  preview,
  guardianLabel,
  issueLabel,
  t
}: {
  preview: RosterImportPreview;
  guardianLabel: (
    row: RosterImportPreview['rows'][number]
  ) => string;
  issueLabel: (issue: RosterIssue) => string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <section>
      <h2>{t('previewTitle')}</h2>

      <p>
        {preview.hasErrors
          ? t('errorsFound')
          : t('ready')}
      </p>

      {preview.issues.length > 0 ? (
        <ul>
          {preview.issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`}>
              <strong>
                {t(
                  issue.level === 'ERROR'
                    ? 'errorLabel'
                    : 'warningLabel'
                )}
              </strong>
              {' — '}
              {issueLabel(issue)}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t('row')}</th>
              <th>{t('student')}</th>
              <th>{t('guardian')}</th>
              <th>{t('class')}</th>
              <th>{t('groups')}</th>
              <th>{t('status')}</th>
            </tr>
          </thead>

          <tbody>
            {preview.rows.map((row) => (
              <tr key={row.rowNumber}>
                <td>{row.rowNumber}</td>
                <td>{row.studentName}</td>
                <td>
                  <div>{row.guardianEmail}</div>
                  <small>{guardianLabel(row)}</small>
                </td>
                <td>
                  {row.class?.nameEn ?? t('invalid')}
                </td>
                <td>
                  {row.groups.length > 0
                    ? row.groups
                        .map((group) =>
                          `${group.subjectNameEn}: ${
                            group.groupNameEn ??
                            t('ungrouped')
                          }`
                        )
                        .join(' · ')
                    : t('none')}
                </td>
                <td>
                  {row.issues.length === 0 ? (
                    t('valid')
                  ) : (
                    <ul>
                      {row.issues.map((issue, index) => (
                        <li
                          key={`${row.rowNumber}-${issue.code}-${index}`}
                        >
                          <strong>
                            {t(
                              issue.level === 'ERROR'
                                ? 'errorLabel'
                                : 'warningLabel'
                            )}
                          </strong>
                          {' — '}
                          {issueLabel(issue)}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
