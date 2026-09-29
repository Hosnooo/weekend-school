'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';

import {Badge} from '@/components/ui/badge';
import {ConfirmationDialog} from '@/components/ui/confirmation-dialog';
import {DataTable, type DataTableColumn} from '@/components/ui/data-table';
import {DropdownMenu, DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {EmptyState} from '@/components/ui/empty-state';
import {StatusBadge} from '@/components/ui/status-badge';
import {
  deleteAdministratorAction,
  setAdministratorActiveAction
} from '@/features/administrators/administrator.actions';
import type {AdministratorListItem} from '@/features/administrators/administrator.repository';
import type {Locale} from '@/i18n/config';
import {Link, useRouter} from '@/i18n/navigation';

type AccessState = 'signedIn' | 'linkSent' | 'unknown';
type LifecycleAction = 'deactivate' | 'reactivate' | 'delete';
type LifecycleTarget = {administrator: AdministratorListItem; action: LifecycleAction};

export function AdministratorManagementList({
  locale,
  administrators,
  accessStates
}: {
  locale: Locale;
  administrators: AdministratorListItem[];
  accessStates: Record<string, AccessState>;
}) {
  const t = useTranslations('administrators');
  const common = useTranslations('common');
  const router = useRouter();
  const [lifecycleTarget, setLifecycleTarget] = useState<LifecycleTarget | null>(null);

  if (administrators.length === 0) {
    return <EmptyState title={t('empty')} description={t('emptyHelp')} />;
  }

  function loginState(administrator: AdministratorListItem) {
    if (!administrator.authUserId) return t('noAccess');
    return t(accessStates[administrator.id] ?? 'unknown');
  }

  async function applyLifecycle() {
    if (!lifecycleTarget) return;
    const {administrator, action} = lifecycleTarget;
    const formData = new FormData();
    formData.set('locale', locale);
    formData.set('administratorId', administrator.id);

    if (action === 'delete') {
      await deleteAdministratorAction(formData);
      return;
    }

    formData.set('isActive', String(action === 'reactivate'));
    await setAdministratorActiveAction(formData);
  }

  function confirmationCopy() {
    if (!lifecycleTarget) return {title: '', description: '', confirmLabel: ''};
    const {administrator, action} = lifecycleTarget;
    if (action === 'delete') {
      return {
        title: t('delete'),
        description: t('deleteConfirm', {name: administrator.displayName}),
        confirmLabel: t('delete')
      };
    }
    if (action === 'reactivate') {
      return {
        title: common('reactivate'),
        description: t('reactivateConfirm', {name: administrator.displayName}),
        confirmLabel: common('reactivate')
      };
    }
    return {
      title: common('deactivate'),
      description: t('deactivateConfirm', {name: administrator.displayName}),
      confirmLabel: common('deactivate')
    };
  }

  const columns: DataTableColumn<AdministratorListItem>[] = [
    {
      key: 'administrator',
      header: t('displayName'),
      render: (administrator) => (
        <div>
          <strong className="record-name">
            <Link href={`/administrators/${administrator.id}`}>{administrator.displayName}</Link>
          </strong>
          <div className="record-meta">{administrator.email ?? common('none')}</div>
        </div>
      )
    },
    {
      key: 'status',
      header: common('status'),
      render: (administrator) => (
        <StatusBadge status={administrator.isActive ? 'active' : 'inactive'}>
          {administrator.isActive ? common('active') : common('inactive')}
        </StatusBadge>
      )
    },
    {
      key: 'login',
      header: t('loginAccess'),
      render: (administrator) => (
        <div>
          <div>{loginState(administrator)}</div>
          {!administrator.authUserId ? <Badge variant="warning">{t('noAccess')}</Badge> : null}
        </div>
      )
    },
    {
      key: 'actions',
      header: common('actions'),
      render: (administrator) => (
        <DropdownMenu label={t('administratorActions', {name: administrator.displayName})}>
          <DropdownMenuItem onSelect={() => router.push(`/administrators/${administrator.id}`)}>
            {t('viewAdministrator')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(`/administrators/${administrator.id}/edit`)}>
            {common('edit')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(`/administrators/${administrator.id}/access`)}>
            {t('manageLoginAccess')}
          </DropdownMenuItem>
          <DropdownMenuItem
            destructive={administrator.isActive}
            onSelect={() => setLifecycleTarget({
              administrator,
              action: administrator.isActive ? 'deactivate' : 'reactivate'
            })}
          >
            {administrator.isActive ? common('deactivate') : common('reactivate')}
          </DropdownMenuItem>
          {!administrator.isActive ? (
            <DropdownMenuItem
              destructive
              onSelect={() => setLifecycleTarget({administrator, action: 'delete'})}
            >
              {t('delete')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenu>
      )
    }
  ];

  const confirmation = confirmationCopy();

  return (
    <>
      <DataTable
        caption={t('listCaption')}
        columns={columns}
        getRowKey={(administrator) => administrator.id}
        rows={administrators}
      />
      <ConfirmationDialog
        cancelLabel={common('cancel')}
        confirmLabel={confirmation.confirmLabel}
        description={confirmation.description}
        onConfirm={applyLifecycle}
        onOpenChange={(open) => {
          if (!open) setLifecycleTarget(null);
        }}
        open={lifecycleTarget !== null}
        title={confirmation.title}
      />
    </>
  );
}
