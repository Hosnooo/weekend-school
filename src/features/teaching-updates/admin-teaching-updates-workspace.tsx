'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';

import {Badge, type BadgeVariant} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Alert} from '@/components/ui/alert';
import {DataTable, type DataTableColumn} from '@/components/ui/data-table';
import {Dialog, DialogClose} from '@/components/ui/dialog';
import {EmptyState} from '@/components/ui/empty-state';
import {
  dismissAdminTeachingUpdateAction,
  reopenAdminTeachingUpdateAction
} from './admin-teaching-update.actions';
import type {
  AdminTeachingUpdate,
  AdminTeachingUpdateContext,
  AdminTeachingUpdateRequestSet,
  AdminTeachingUpdateSource,
  AdminTeachingUpdateStatus
} from './admin-teaching-update.types';
import {RequestTeachingUpdateDialog} from './request-teaching-update-dialog';
import {formatTeachingUpdateDate, formatTeachingUpdateRange} from './teaching-update-date';

type SourceFilter = 'ALL' | AdminTeachingUpdateSource;

function statusVariant(status: AdminTeachingUpdateStatus): BadgeVariant {
  if (status === 'SUBMITTED') return 'success';
  if (status === 'OPEN') return 'warning';
  return 'neutral';
}

export function AdminTeachingUpdatesWorkspace({
  contexts,
  locale,
  notice,
  requestSets,
  updates
}: {
  contexts: AdminTeachingUpdateContext[];
  locale: string;
  notice: string | null;
  requestSets: AdminTeachingUpdateRequestSet[];
  updates: AdminTeachingUpdate[];
}) {
  const t = useTranslations('adminTeachingUpdates');
  const [source, setSource] = useState<SourceFilter>('ALL');
  const [selected, setSelected] = useState<AdminTeachingUpdate | null>(null);

  const localName = (en: string, ar: string | null) =>
    locale === 'ar' && ar ? ar : en;

  const activeLocale = locale === 'ar' ? 'ar' : 'en';
  const openTeachingUpdates = updates
    .filter((item) => item.status === 'OPEN')
    .sort((a, b) => Number(b.source === 'ADMIN_REQUEST') - Number(a.source === 'ADMIN_REQUEST'));
  const historyTeachingUpdates = updates.filter((item) =>
    item.status === 'SUBMITTED' &&
    (source === 'ALL' || item.source === source)
  );
  const activeRequests = requestSets.filter((item) => item.openCount > 0);

  const statusLabel = (value: AdminTeachingUpdateStatus) =>
    value === 'SUBMITTED'
      ? t('submitted')
      : value === 'DISMISSED'
        ? t('dismissed')
        : t('open');

  const sourceLabel = (value: AdminTeachingUpdateSource) =>
    value === 'ADMIN_REQUEST'
      ? t('adminRequested')
      : t('teacherCreated');

  const columns: DataTableColumn<AdminTeachingUpdate>[] = [
    {
      key: 'context',
      header: t('context'),
      render: (update) => (
        <div>
          <strong>
            {localName(update.classNameEn, update.classNameAr)}
            {' · '}
            {localName(update.subjectNameEn, update.subjectNameAr)}
          </strong>
          <div>
            <small>
              {update.groupNameEn
                ? localName(update.groupNameEn, update.groupNameAr)
                : t('wholeSubject')}
            </small>
          </div>
        </div>
      )
    },
    {
      key: 'status',
      header: t('status'),
      render: (update) => (
        <Badge variant={statusVariant(update.status)}>
          {statusLabel(update.status)}
        </Badge>
      )
    },
    {
      key: 'source',
      header: t('source'),
      render: (update) => (
        <Badge variant={update.source === 'ADMIN_REQUEST' ? 'info' : 'neutral'}>
          {sourceLabel(update.source)}
        </Badge>
      )
    },
    {
      key: 'teacher',
      header: t('teacher'),
      render: (update) => update.teacherName ?? t('unclaimed')
    },
    {
      key: 'coverage',
      header: t('coverageShort'),
      render: (update) =>
        update.coverageKind === 'DATES'
          ? update.exactDates.map((date) => formatTeachingUpdateDate(date, activeLocale)).join(', ')
          : formatTeachingUpdateRange(update.periodStart, update.periodEnd, activeLocale)
    },
    {
      key: 'actions',
      header: t('details'),
      render: (update) => (
        <Button
          onClick={() => setSelected(update)}
          size="compact"
          type="button"
          variant="secondary"
        >
          {t('viewDetails')}
        </Button>
      )
    }
  ];

  return (
    <div className="stack">
      {notice ? <Alert variant="info">{notice}</Alert> : null}

      <div className="page-actions">
        <RequestTeachingUpdateDialog contexts={contexts} locale={locale}/>
      </div>

      <section className="detail-section admin-update-active-list">
        <h2>{t('currentWork')}</h2>
        {openTeachingUpdates.length === 0 ? (
          <EmptyState title={t('noOpenUpdates')} />
        ) : (
          <DataTable
            columns={columns}
            getRowKey={(row) => row.id}
            rows={openTeachingUpdates}
          />
        )}
      </section>

      {activeRequests.length > 0 ? (
        <section className="detail-section admin-update-requests">
          <h2>{t('recentRequests')}</h2>
          <div className="compact-record-list">
            {activeRequests.map((requestSet) => (
              <div className="compact-record-row" key={requestSet.id}>
                <div>
                  <strong className="record-name">
                    {localName(requestSet.classNameEn, requestSet.classNameAr)}
                    {' · '}
                    {localName(requestSet.subjectNameEn, requestSet.subjectNameAr)}
                  </strong>
                  <p className="record-meta">
                    {t('progress', {
                      submitted: requestSet.submittedCount,
                      total: requestSet.totalCount
                    })}
                  </p>
                </div>
                <progress
                  aria-label={t('progress', {
                    submitted: requestSet.submittedCount,
                    total: requestSet.totalCount
                  })}
                  max={Math.max(requestSet.totalCount, 1)}
                  value={requestSet.submittedCount}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <details className="secondary-disclosure admin-update-history">
        <summary>{t('history')}</summary>
        <div className="stack">
          <div className="form-grid">
            <label>
              <span>{t('source')}</span>
              <select value={source} onChange={(event) => setSource(event.target.value as SourceFilter)}>
                <option value="ALL">{t('all')}</option>
                <option value="TEACHER">{t('teacherCreated')}</option>
                <option value="ADMIN_REQUEST">{t('adminRequested')}</option>
              </select>
            </label>
          </div>
          {historyTeachingUpdates.length === 0 ? (
            <EmptyState title={t('noUpdates')} description={t('noUpdatesHelp')} />
          ) : (
            <DataTable columns={columns} getRowKey={(row) => row.id} rows={historyTeachingUpdates} />
          )}
        </div>
      </details>

      <TeachingUpdateDetails
        locale={locale}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        update={selected}
      />
    </div>
  );
}

function TeachingUpdateDetails({
  locale,
  onOpenChange,
  update
}: {
  locale: string;
  onOpenChange: (open: boolean) => void;
  update: AdminTeachingUpdate | null;
}) {
  const t = useTranslations('adminTeachingUpdates');

  if (!update) return null;

  const localName = (en: string, ar: string | null) =>
    locale === 'ar' && ar ? ar : en;

  return (
    <Dialog
      onOpenChange={onOpenChange}
      open
      title={`${localName(update.classNameEn, update.classNameAr)} · ${localName(
        update.subjectNameEn,
        update.subjectNameAr
      )}`}
    >
      <div className="stack">
        <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
          <Badge variant={statusVariant(update.status)}>
            {update.status === 'OPEN'
              ? t('open')
              : update.status === 'SUBMITTED'
                ? t('submitted')
                : t('dismissed')}
          </Badge>
          <Badge variant={update.source === 'ADMIN_REQUEST' ? 'info' : 'neutral'}>
            {update.source === 'ADMIN_REQUEST'
              ? t('adminRequested')
              : t('teacherCreated')}
          </Badge>
        </div>

        <p>
          <strong>{t('teacher')}:</strong>{' '}
          {update.teacherName ?? t('unclaimed')}
        </p>

        <p>
          <strong>{t('coverage')}:</strong>{' '}
          {update.coverageKind === 'DATES'
            ? update.exactDates.join(', ')
            : `${update.periodStart} — ${update.periodEnd}`}
        </p>

        {update.adminNote ? (
          <p><strong>{t('adminNote')}:</strong> {update.adminNote}</p>
        ) : null}

        <small>
          {t('created')}: {update.createdAt}
          {' · '}
          {t('updated')}: {update.updatedAt}
        </small>

        {update.dismissalReason ? (
          <p>
            <strong>{t('dismissalReason')}:</strong>{' '}
            {update.dismissalReason}
          </p>
        ) : null}

        {update.status === 'OPEN' ? (
          <form action={dismissAdminTeachingUpdateAction} className="stack">
            <input name="locale" type="hidden" value={locale}/>
            <input name="submissionId" type="hidden" value={update.id}/>
            <input name="version" type="hidden" value={update.version}/>
            <label>
              <span>{t('reason')}</span>
              <input name="reason" placeholder={t('optionalReason')}/>
            </label>
            <Button type="submit" variant="secondary">
              {t('dismiss')}
            </Button>
          </form>
        ) : null}

        {update.status === 'SUBMITTED' ? (
          <form action={reopenAdminTeachingUpdateAction}>
            <input name="locale" type="hidden" value={locale}/>
            <input name="submissionId" type="hidden" value={update.id}/>
            <Button type="submit" variant="secondary">
              {t('reopen')}
            </Button>
          </form>
        ) : null}

        <DialogClose>{t('close')}</DialogClose>
      </div>
    </Dialog>
  );
}
