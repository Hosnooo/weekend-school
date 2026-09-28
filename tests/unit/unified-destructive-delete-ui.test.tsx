import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {ManagedArchiveTable} from '@/features/archives/managed-archive-table';

describe('unified destructive delete UI', () => {
  it('allows archived managed records with related data to be deleted by name', () => {
    const records = [
      ['CLASS', 'class-1', 'Foundations'],
      ['SUBJECT', 'subject-1', 'Arabic'],
      ['GROUP', 'group-1', 'Blue Group'],
      ['TEACHER', 'teacher-1', 'Teacher One'],
      ['GUARDIAN', 'guardian-1', 'Guardian One']
    ] as const;

    render(
      <ManagedArchiveTable
        labels={{
          sectionTitle: 'Archived records',
          empty: 'None',
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
          confirmation: 'Type the record name exactly to confirm',
          blockedReason: 'Blocked',
          dependencyLabels: {
            classSubjects: 'Class subjects',
            groups: 'Groups',
            enrollments: 'Enrollments',
            memberships: 'Memberships',
            teachingAssignments: 'Teaching assignments',
            weeklySubmissions: 'Weekly submissions',
            studentLinks: 'Student links',
            accountLinks: 'Account links'
          }
        }}
        locale="en"
        records={records.map(([entityType, id, name]) => ({
          entityType,
          id,
          name,
          impact: {
            entityType,
            entityId: id,
            isArchived: true,
            canPermanentlyDelete: false,
            dependencyCount: 2,
            dependencies: {
              weeklySubmissions: 1,
              teachingAssignments: 1
            }
          }
        }))}
        restoreAction={vi.fn()}
        permanentDeleteAction={vi.fn()}
      />
    );

    expect(
      screen.getAllByText('Deletes related data')
    ).toHaveLength(5);

    for (const [, , name] of records) {
      expect(
        screen.getByPlaceholderText(name)
      ).toBeEnabled();
    }

    for (
      const button of screen.getAllByRole('button', {
        name: 'Permanently delete'
      })
    ) {
      expect(button).toBeEnabled();
    }
  });
});
