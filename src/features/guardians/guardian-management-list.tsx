'use client';

import {useState} from 'react';

import {lifecycleErrorKey} from '@/lib/validation/lifecycle-feedback';
import {useTranslations} from 'next-intl';

import {ConfirmationDialog} from '@/components/ui/confirmation-dialog';
import {DataTable, type DataTableColumn} from '@/components/ui/data-table';
import {DropdownMenu, DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {EmptyState} from '@/components/ui/empty-state';
import {StatusBadge} from '@/components/ui/status-badge';
import {archiveManagedEntityAction} from '@/features/archives/archive.actions';
import {changeGuardianActiveMutationAction} from '@/features/guardians/guardian.actions';
import type {GuardianListItem} from '@/features/guardians/guardian.types';
import type {Locale} from '@/i18n/config';
import {Link, useRouter} from '@/i18n/navigation';

export function GuardianManagementList({locale, guardians}: {locale: Locale; guardians: GuardianListItem[]}) {
  const t = useTranslations('guardians');
  const common = useTranslations('common');
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);
  const [lifecycleTarget, setLifecycleTarget] = useState<GuardianListItem | null>(null);

  if (guardians.length === 0) return <EmptyState title={t('empty')} />;

  async function applyLifecycle() {
    if (!lifecycleTarget) return;
    const formData = new FormData();
    formData.set('locale', locale);
    formData.set('id', lifecycleTarget.id);
    try {
      const result = lifecycleTarget.isActive
        ? await (async () => {
            formData.set('entityType', 'GUARDIAN');
            return archiveManagedEntityAction(formData);
          })()
        : await (async () => {
            formData.set('isActive', 'true');
            return changeGuardianActiveMutationAction(formData);
          })();
      if (!result.ok) {
        setFailure(common(lifecycleErrorKey(result.error)));
        return;
      }
      setFailure(null);
      router.refresh();
    } catch {
      setFailure(common('lifecycleError'));
    }
  }

  const columns: DataTableColumn<GuardianListItem>[] = [
    {
      key: 'guardian',
      header: t('name'),
      render: (guardian) => (
        <div>
          <Link href={`/guardians/${guardian.id}`}><strong className="record-name">{guardian.name}</strong></Link>
          <div className="record-meta"><a href={`mailto:${guardian.email}`}>{guardian.email}</a></div>
        </div>
      )
    },
    {
      key: 'status',
      header: common('status'),
      render: (guardian) => (
        <StatusBadge status={guardian.isActive ? 'active' : 'inactive'}>
          {guardian.isActive ? common('active') : common('inactive')}
        </StatusBadge>
      )
    },
    {
      key: 'actions',
      header: common('actions'),
      render: (guardian) => (
        <DropdownMenu label={`${common('actions')}: ${guardian.name}`}>
          <DropdownMenuItem onSelect={() => router.push(`/guardians/${guardian.id}/edit`)}>
            {common('edit')}
          </DropdownMenuItem>
          <DropdownMenuItem destructive={guardian.isActive} onSelect={() => {setFailure(null); setLifecycleTarget(guardian);}}>
            {guardian.isActive ? common('deactivate') : common('reactivate')}
          </DropdownMenuItem>
        </DropdownMenu>
      )
    }
  ];

  return (
    <>
      {failure ? <p className="form-error" role="alert" aria-live="polite">{failure}</p> : null}
      <DataTable caption={t('title')} columns={columns} getRowKey={(guardian) => guardian.id} rows={guardians} />
      <ConfirmationDialog
        cancelLabel={common('cancel')}
        confirmLabel={lifecycleTarget?.isActive ? common('deactivate') : common('reactivate')}
        description={lifecycleTarget ? `${lifecycleTarget.isActive ? common('deactivate') : common('reactivate')} ${lifecycleTarget.name}?` : ''}
        onConfirm={applyLifecycle}
        onOpenChange={(open) => {
          if (!open) setLifecycleTarget(null);
        }}
        open={lifecycleTarget !== null}
        title={lifecycleTarget?.isActive ? common('deactivate') : common('reactivate')}
      />
    </>
  );
}
