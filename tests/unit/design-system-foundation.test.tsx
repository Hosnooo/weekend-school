import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {Alert} from '@/components/ui/alert';
import {Breadcrumbs} from '@/components/ui/breadcrumbs';
import {Button} from '@/components/ui/button';
import {ConfirmationDialog} from '@/components/ui/confirmation-dialog';
import {DataTable} from '@/components/ui/data-table';
import {Dialog, DialogClose} from '@/components/ui/dialog';
import {DropdownMenu, DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {EmptyState} from '@/components/ui/empty-state';
import {FormField} from '@/components/ui/form-field';
import {IconButton} from '@/components/ui/icon-button';
import {Input} from '@/components/ui/input';
import {PageHeader} from '@/components/ui/page-header';
import {Select} from '@/components/ui/select';
import {Sheet, SheetClose} from '@/components/ui/sheet';
import {Tabs} from '@/components/ui/tabs';

describe('design-system foundation contracts', () => {
  it('applies the compact size contract without leaking the size prop to the DOM', () => {
    render(<Button size="compact">Save</Button>);

    const button = screen.getByRole('button', {name: 'Save'});
    expect(button).toHaveClass('button-compact');
    expect(button).not.toHaveAttribute('size');
  });

  it('renders field errors as an accessible alert tied to the field', () => {
    render(
      <FormField htmlFor="email" label="Email" error="Enter a valid email address.">
        <input id="email" />
      </FormField>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-describedby', 'email-error');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('opens and closes the dialog and restores focus to its trigger', async () => {
    const user = userEvent.setup();
    render(
      <Dialog trigger={<Button>Open dialog</Button>} title="Example dialog">
        <p>Dialog body</p>
        <DialogClose>Cancel</DialogClose>
      </Dialog>
    );

    const trigger = screen.getByRole('button', {name: 'Open dialog'});
    await user.click(trigger);
    expect(screen.getByRole('dialog', {name: 'Example dialog'})).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(screen.queryByRole('dialog', {name: 'Example dialog'})).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('supports keyboard activation of an overflow menu', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DropdownMenu label="More actions">
        <DropdownMenuItem onSelect={onSelect}>Edit</DropdownMenuItem>
        <DropdownMenuItem>Archive</DropdownMenuItem>
      </DropdownMenu>
    );

    const trigger = screen.getByRole('button', {name: 'More actions'});
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menuitem', {name: 'Edit'})).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('switches tabs without rendering all panels simultaneously', async () => {
    const user = userEvent.setup();
    render(
      <Tabs
        defaultValue="current"
        items={[
          {value: 'current', label: 'Current', content: <p>Current assignments</p>},
          {value: 'past', label: 'Past', content: <p>Past assignments</p>}
        ]}
        label="Assignment views"
      />
    );

    expect(screen.getByRole('tablist', {name: 'Assignment views'})).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Current assignments');
    expect(screen.queryByText('Past assignments')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', {name: 'Past'}));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Past assignments');
    expect(screen.queryByText('Current assignments')).not.toBeInTheDocument();
  });

  it('preserves row actions and labels in the narrow DataTable fallback', () => {
    render(
      <DataTable
        columns={[
          {key: 'name', header: 'Teacher', render: (row) => row.name},
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => <button aria-label={`Actions for ${row.name}`}>•••</button>
          }
        ]}
        rows={[{id: 'teacher-1', name: 'Ahmed'}]}
        getRowKey={(row) => row.id}
      />
    );

    expect(screen.getByText('Ahmed').closest('td')).toHaveAttribute('data-label', 'Teacher');
    expect(screen.getByRole('button', {name: 'Actions for Ahmed'})).toBeInTheDocument();
  });

  it('renders RTL-safe breadcrumb ordering without hardcoded directional classes', () => {
    const {container} = render(
      <div dir="rtl">
        <Breadcrumbs items={[{label: 'Teachers'}, {label: 'Ahmed Ali'}]} label="Navigation path" />
      </div>
    );

    expect(screen.getByRole('navigation', {name: 'Navigation path'})).toHaveAttribute('dir', 'inherit');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent?.replace('›', '').trim())).toEqual([
      'Teachers',
      'Ahmed Ali'
    ]);
    expect(container.querySelector('.breadcrumbs-separator')?.className).not.toMatch(/\b(?:left|right|ml-|mr-)/);
  });

  it('keeps confirmation destructive actions explicit and invokes confirm once', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        cancelLabel="Cancel"
        confirmLabel="Delete assignment"
        description="This action cannot be undone."
        onConfirm={onConfirm}
        title="Delete this assignment?"
        trigger={<Button variant="danger">Delete</Button>}
      />
    );

    await user.click(screen.getByRole('button', {name: 'Delete'}));
    expect(screen.getByRole('dialog', {name: 'Delete this assignment?'})).toHaveTextContent('This action cannot be undone.');
    await user.click(screen.getByRole('button', {name: 'Delete assignment'}));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('gives alerts, empty states, icon actions, fields, and page headers clear semantics', () => {
    render(
      <>
        <PageHeader actions={<Button>Add teacher</Button>} description="Manage teaching staff." title="Teachers" />
        <Alert variant="warning">Login access missing.</Alert>
        <EmptyState action={<Button>Add assignment</Button>} description="Add one to get started." title="No assignments" />
        <IconButton label="More actions">•••</IconButton>
        <FormField htmlFor="name" label="Name"><Input id="name" /></FormField>
        <FormField htmlFor="status" label="Status"><Select id="status"><option>Active</option></Select></FormField>
      </>
    );

    expect(screen.getByRole('heading', {level: 1, name: 'Teachers'})).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Login access missing.');
    expect(screen.getByRole('heading', {name: 'No assignments'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'More actions'})).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveClass('input');
    expect(screen.getByLabelText('Status')).toHaveClass('select');
  });

  it('uses dialog semantics for a narrow-screen sheet and restores trigger focus', async () => {
    const user = userEvent.setup();
    render(
      <Sheet title="Navigation" trigger={<Button>Open navigation</Button>}>
        <p>Navigation body</p>
        <SheetClose>Close navigation</SheetClose>
      </Sheet>
    );

    const trigger = screen.getByRole('button', {name: 'Open navigation'});
    await user.click(trigger);
    expect(screen.getByRole('dialog', {name: 'Navigation'})).toHaveClass('sheet-content');
    await user.click(screen.getByRole('button', {name: 'Close navigation'}));
    expect(trigger).toHaveFocus();
  });
});
