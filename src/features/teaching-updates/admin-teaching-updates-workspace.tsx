'use client';

import {useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';

import {Badge, type BadgeVariant} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
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

type StatusFilter = 'ALL' | AdminTeachingUpdateStatus;
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
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [source, setSource] = useState<SourceFilter>('ALL');
  const [selected, setSelected] = useState<AdminTeachingUpdate | null>(null);

  const localName = (en: string, ar: string | null) =>
    locale === 'ar' && ar ? ar : en;

  const summary = useMemo(() => ({
    open: updates.filter((item) => item.status === 'OPEN').length,
    submitted: updates.filter((item) => item.status === 'SUBMITTED').length,
    dismissed: updates.filter((item) => item.status === 'DISMISSED').length,
    attention: updates.filter(
      (item) => item.status === 'OPEN' && item.source === 'ADMIN_REQUEST'
    ).length
  }), [updates]);

  const filtered = updates.filter((item) =>
    (status === 'ALL' || item.status === status) &&
    (source === 'ALL' || item.source === source)
  );

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
          ? update.exactDates.join(', ')
          : `${update.periodStart} — ${update.periodEnd}`
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
      {notice ? <Card><strong>{notice}</strong></Card> : null}

      <div style={{display: 'flex', justifyContent: 'flex-end'}}>
        <RequestTeachingUpdateDialog contexts={contexts} locale={locale}/>
      </div>

      <div className="group-cards">
        {[
          [t('summaryOpen'), summary.open],
          [t('summarySubmitted'), summary.submitted],
          [t('summaryDismissed'), summary.dismissed],
          [t('summaryNeedsAttention'), summary.attention]
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <div className="stack">
              <strong style={{fontSize: '1.8rem'}}>{value}</strong>
              <span>{label}</span>
            </div>
          </Card>
        ))}
      </div>

      {requestSets.length > 0 ? (
        <div className="stack">
          <h2>{t('recentRequests')}</h2>
          <div className="group-cards">
            {requestSets.slice(0, 4).map((requestSet) => (
              <Card key={requestSet.id}>
                <div className="stack">
                  <strong>
                    {localName(requestSet.classNameEn, requestSet.classNameAr)}
                    {' · '}
                    {localName(requestSet.subjectNameEn, requestSet.subjectNameAr)}
                  </strong>
                  <progress
                    max={Math.max(requestSet.totalCount, 1)}
                    style={{width: '100%'}}
                    value={requestSet.submittedCount}
                  />
                  <span>
                    {t('progress', {
                      submitted: requestSet.submittedCount,
                      total: requestSet.totalCount
                    })}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <Card>
        <div className="stack">
          <strong>{t('filters')}</strong>
          <div className="form-grid">
            <label>
              <span>{t('status')}</span>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as StatusFilter)
                }
              >
                <option value="ALL">{t('all')}</option>
                <option value="OPEN">{t('open')}</option>
                <option value="SUBMITTED">{t('submitted')}</option>
                <option value="DISMISSED">{t('dismissed')}</option>
              </select>
            </label>

            <label>
              <span>{t('source')}</span>
              <select
                value={source}
                onChange={(event) =>
                  setSource(event.target.value as SourceFilter)
                }
              >
                <option value="ALL">{t('all')}</option>
                <option value="TEACHER">{t('teacherCreated')}</option>
                <option value="ADMIN_REQUEST">{t('adminRequested')}</option>
              </select>
            </label>
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          description={t('noUpdatesHelp')}
          title={t('noUpdates')}
        />
      ) : (
        <Card>
          <DataTable
            columns={columns}
            getRowKey={(row) => row.id}
            rows={filtered}
          />
        </Card>
      )}

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
