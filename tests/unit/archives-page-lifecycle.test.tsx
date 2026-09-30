import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';


vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => {
    const messages: Record<string, string> = {
      pageTitle: 'Archives',
      pageDescription:
        'Restore inactive records or permanently delete only records with no protected dependencies.',
      otherTitle: 'Other archived records',
      otherEmpty: 'No other archived records.',
      type: 'Type',
      name: 'Name',
      dependencies: 'Protected dependencies',
      status: 'Status',
      actions: 'Actions',
      safe: 'Safe to delete',
      blocked: 'Unavailable',
      destructive: 'Deletes related data',
      permanentDelete: 'Permanently delete',
      blockedReason:
        'Permanent deletion is blocked by protected dependencies.',
      'dependency.accountLinks': 'Account links',
      'dependency.teachingAssignments': 'Teaching assignments',
      'dependency.groupAssignments': 'Group assignments',
      'dependency.weeklySubmissions': 'Weekly submissions',
      'dependency.studentLinks': 'Student links',
      'dependency.classSubjects': 'Class subjects',
      'dependency.enrollments': 'Enrollments',
      'dependency.memberships': 'Memberships',
      'dependency.defaultUse': 'Default group use',
      archivedStudents: 'Archived students',
      emptyStudents: 'No archived students',
      restore: 'Restore',
      viewHistory: 'View data/history',
      downloadData: 'Download data',
      downloadFirst: 'Download data first',
      deleteImpact: 'Deletion impact',
      memberships: 'Memberships',
      attendanceObservations: 'Attendance observations',
      attendanceResolutions: 'Attendance resolutions',
      comments: 'Comments',
      reports: 'Reports',
      emailDeliveries: 'Email deliveries',
      confirmation: 'Confirmation',
      confirmationError: 'Type the record name exactly as shown.',
      dependenciesError:
        'Unable to permanently delete this record.',
      deleteError:
        'Unable to permanently delete this record.',
      deleted: 'Archived record permanently deleted.'
    };

    return (key: string) => messages[key] ?? key;
  })
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn()
}));

vi.mock('@/components/ui/admin-page', () => ({
  AdminPage: ({
    title,
    description,
    children
  }: {
    title: string;
    description: string;
    children: React.ReactNode;
  }) => (
    <section>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </section>
  )
}));

vi.mock('@/lib/auth/require-profile', () => ({
  requireAdministrator: vi.fn(async () => ({
    id: 'admin-1',
    schoolId: 'school-1'
  }))
}));

vi.mock('@/features/archives/archive.actions', () => ({
  downloadArchivedStudentDataAction: vi.fn(),
  permanentlyDeleteArchivedStudentAction: vi.fn(),
  permanentlyDeleteManagedEntityAction: vi.fn(),
  restoreArchivedStudentAction: vi.fn(),
  restoreManagedEntityAction: vi.fn()
}));

vi.mock('@/features/archives/archive.repository', () => ({
  listArchivedStudents: vi.fn(async () => []),
  listManagedArchivedRecords: vi.fn(async () => [])
}));

import ArchivesPage from '@/app/[locale]/(protected)/(admin)/archives/page';
import {
  listArchivedStudents,
  listManagedArchivedRecords
} from '@/features/archives/archive.repository';

describe('Archives lifecycle workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listArchivedStudents).mockResolvedValue([]);
    vi.mocked(listManagedArchivedRecords).mockResolvedValue([]);
  });

  it('keeps Restore immediate and reveals permanent delete only after opening the action', async () => {
    vi.mocked(listManagedArchivedRecords).mockResolvedValue([
      {
        entityType: 'TEACHER',
        id: 'teacher-1',
        name: 'Archived Teacher',
        impact: {
          entityType: 'TEACHER',
          entityId: 'teacher-1',
          isArchived: true,
          canPermanentlyDelete: true,
          dependencyCount: 0,
          dependencies: {}
        }
      }
    ]);

    render(
      await ArchivesPage({
        params: Promise.resolve({locale: 'en'}),
        searchParams: Promise.resolve({})
      })
    );

    expect(screen.getByText('Archived Teacher')).toBeVisible();
    expect(screen.getByText('Safe to delete')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Restore'})).toBeVisible();
    const deleteDisclosure = screen.getByText('Permanently delete', {selector: 'summary'});
    expect(deleteDisclosure.closest('details')).not.toHaveAttribute('open');
    await userEvent.click(deleteDisclosure);
    expect(deleteDisclosure.closest('details')).toHaveAttribute('open');
    expect(
      screen.getByRole('button', {name: 'Permanently delete'})
    ).toBeEnabled();
  });

  it('shows destructive impact and keeps permanent delete enabled', async () => {
    vi.mocked(listManagedArchivedRecords).mockResolvedValue([
      {
        entityType: 'CLASS',
        id: 'class-1',
        name: 'Archived Foundations',
        impact: {
          entityType: 'CLASS',
          entityId: 'class-1',
          isArchived: true,
          canPermanentlyDelete: false,
          dependencyCount: 3,
          dependencies: {
            classSubjects: 2,
            enrollments: 1
          }
        }
      }
    ]);

    render(
      await ArchivesPage({
        params: Promise.resolve({locale: 'en'}),
        searchParams: Promise.resolve({})
      })
    );

    expect(screen.getByText('Archived Foundations')).toBeVisible();
    expect(
      screen.getByText('Deletes related data')
    ).toBeVisible();

    await userEvent.click(screen.getByText('Permanently delete', {selector: 'summary'}));

    const deleteButton = screen.getByRole('button', {
      name: 'Permanently delete'
    });

    expect(deleteButton).toBeVisible();
    expect(deleteButton).toBeEnabled();

    expect(
      screen.getByText(/class subjects.*2/i)
    ).toBeVisible();

    expect(
      screen.getByText(/enrollments.*1/i)
    ).toBeVisible();
  });
});
