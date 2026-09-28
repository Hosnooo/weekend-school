import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {ManagedArchiveTable} from '@/features/archives/managed-archive-table';

describe('archived Class destructive deletion', () => {
  it('shows impact but allows an archived Class with dependencies to be deleted', () => {
    render(
      <ManagedArchiveTable
        labels={{
          sectionTitle: 'Other archived records',
          empty: 'No archived records',
          type: 'Type',
          name: 'Name',
          dependencies: 'Data that will be deleted',
          status: 'Status',
          actions: 'Actions',
          safe: 'Safe to delete',
          blocked: 'Deletion blocked',
          destructive: 'Deletes related data',
          restore: 'Restore',
          permanentDelete: 'Permanently delete',
          confirmation: 'Type the Class name to confirm',
          blockedReason: 'Protected dependencies prevent deletion',
          dependencyLabels: {
            classSubjects: 'Class subjects',
            groups: 'Groups',
            enrollments: 'Enrollments',
            memberships: 'Group memberships',
            teachingAssignments: 'Teaching assignments',
            weeklySubmissions: 'Weekly submissions',
            attendanceResolutions: 'Attendance resolutions',
            reportBatches: 'Report batches',
            reports: 'Finalized reports',
            emailDeliveries: 'Email deliveries'
          }
        }}
        locale="en"
        records={[
          {
            entityType: 'CLASS',
            id: 'class-1',
            name: 'Archived Foundations',
            impact: {
              entityType: 'CLASS',
              entityId: 'class-1',
              isArchived: true,
              canPermanentlyDelete: false,
              dependencyCount: 8,
              dependencies: {
                classSubjects: 2,
                enrollments: 6
              }
            }
          }
        ]}
        restoreAction={vi.fn()}
        permanentDeleteAction={vi.fn()}
      />
    );

    expect(screen.getByText('Class subjects: 2')).toBeVisible();
    expect(screen.getByText('Enrollments: 6')).toBeVisible();
    expect(screen.getByText('Deletes related data')).toBeVisible();

    expect(
      screen.getByRole('button', {name: 'Permanently delete'})
    ).toBeEnabled();

    expect(
      screen.getByLabelText('Type the Class name to confirm')
    ).toHaveAttribute('placeholder', 'Archived Foundations');
  });
});
