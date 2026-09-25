'use client';

import {useTranslations} from 'next-intl';

import {Alert} from '@/components/ui/alert';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {ConfirmationDialog} from '@/components/ui/confirmation-dialog';
import {DataTable, type DataTableColumn} from '@/components/ui/data-table';
import {DateField} from '@/components/ui/date-field';
import {Dialog, DialogClose} from '@/components/ui/dialog';
import {DropdownMenu, DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {EmptyState} from '@/components/ui/empty-state';
import {FormField} from '@/components/ui/form-field';
import {IconButton} from '@/components/ui/icon-button';
import {Input} from '@/components/ui/input';
import {PageHeader} from '@/components/ui/page-header';
import {SearchInput} from '@/components/ui/search-input';
import {SectionHeader} from '@/components/ui/section-header';
import {Select} from '@/components/ui/select';
import {Sheet, SheetClose} from '@/components/ui/sheet';
import {Tabs} from '@/components/ui/tabs';

export function UIReference() {
  const app = useTranslations('app');
  const common = useTranslations('common');
  const navigation = useTranslations('navigation');
  const students = useTranslations('students');
  const teachers = useTranslations('teachers');
  const weekly = useTranslations('weekly');

  const rows = [{id: 'sample', name: teachers('displayName'), status: common('active')}];
  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    {key: 'name', header: teachers('name'), render: (row) => row.name},
    {key: 'status', header: common('status'), render: (row) => <Badge variant="success">{row.status}</Badge>},
    {
      key: 'actions',
      header: common('actions'),
      render: () => (
        <DropdownMenu label={common('actions')}>
          <DropdownMenuItem>{common('edit')}</DropdownMenuItem>
          <DropdownMenuItem destructive>{common('deactivate')}</DropdownMenuItem>
        </DropdownMenu>
      )
    }
  ];

  return (
    <div className="ui-reference">
      <PageHeader
        actions={<Button>{teachers('addTeacher')}</Button>}
        breadcrumbLabel={navigation('label')}
        breadcrumbs={[{label: navigation('dashboard'), href: '#'}, {label: teachers('title')}]}
        description={teachers('description')}
        title={app('name')}
      />

      <section className="ui-reference-section">
        <SectionHeader description={teachers('assignmentHelp')} title={common('actions')} />
        <Card>
          <div className="ui-reference-row">
            <Button>{common('save')}</Button>
            <Button variant="secondary">{common('cancel')}</Button>
            <Button variant="ghost">{common('edit')}</Button>
            <Button variant="danger">{common('deactivate')}</Button>
            <Button size="compact" variant="secondary">{common('save')}</Button>
            <IconButton label={common('actions')}>•••</IconButton>
          </div>
        </Card>
      </section>

      <section className="ui-reference-section">
        <SectionHeader title={common('status')} />
        <div className="ui-reference-grid">
          <Alert variant="success">{teachers('accessSent')}</Alert>
          <Alert variant="warning">{teachers('accessFailed')}</Alert>
          <Alert variant="danger">{common('saveError')}</Alert>
          <Card>
            <div className="ui-reference-row">
              <Badge variant="success">{common('active')}</Badge>
              <Badge variant="warning">{common('inactive')}</Badge>
              <Badge variant="info">{weekly('submissionStatus.DRAFT')}</Badge>
            </div>
          </Card>
        </div>
      </section>

      <section className="ui-reference-section">
        <SectionHeader title={students('enrollment')} />
        <Card>
          <div className="ui-reference-grid">
            <FormField htmlFor="reference-name" label={teachers('displayName')} required>
              <Input id="reference-name" placeholder={teachers('displayName')} />
            </FormField>
            <FormField htmlFor="reference-class" label={teachers('class')}>
              <Select defaultValue="active" id="reference-class">
                <option value="active">{common('active')}</option>
                <option value="inactive">{common('inactive')}</option>
              </Select>
            </FormField>
            <FormField htmlFor="reference-date" label={teachers('startsOn')}>
              <DateField id="reference-date" />
            </FormField>
            <FormField htmlFor="reference-search" label={students('search')}>
              <SearchInput aria-label={students('search')} id="reference-search" placeholder={students('search')} />
            </FormField>
          </div>
        </Card>
      </section>

      <section className="ui-reference-section">
        <SectionHeader title={teachers('title')} />
        <DataTable columns={columns} getRowKey={(row) => row.id} rows={rows} />
        <EmptyState
          action={<Button>{teachers('addAssignment')}</Button>}
          description={teachers('assignmentHelp')}
          title={teachers('noAssignments')}
        />
      </section>

      <section className="ui-reference-section">
        <SectionHeader title={teachers('assignments')} />
        <Tabs
          defaultValue="active"
          items={[
            {value: 'active', label: common('active'), content: <Alert>{teachers('assignmentHelp')}</Alert>},
            {value: 'inactive', label: common('inactive'), content: <Alert variant="warning">{teachers('noAssignments')}</Alert>}
          ]}
          label={teachers('assignments')}
        />
      </section>

      <section className="ui-reference-section">
        <SectionHeader title={navigation('label')} />
        <div className="ui-reference-row">
          <Dialog title={teachers('addAssignment')} trigger={<Button variant="secondary">{teachers('addAssignment')}</Button>}>
            <p className="dialog-description">{teachers('assignmentHelp')}</p>
            <div className="dialog-actions"><DialogClose>{common('cancel')}</DialogClose></div>
          </Dialog>
          <Sheet title={navigation('label')} trigger={<Button variant="secondary">{navigation('label')}</Button>}>
            <p className="dialog-description">{teachers('description')}</p>
            <div className="dialog-actions"><SheetClose>{common('cancel')}</SheetClose></div>
          </Sheet>
          <ConfirmationDialog
            cancelLabel={common('cancel')}
            confirmLabel={common('deactivate')}
            description={teachers('description')}
            onConfirm={() => undefined}
            title={common('deactivate')}
            trigger={<Button variant="danger">{common('deactivate')}</Button>}
          />
        </div>
      </section>
    </div>
  );
}
