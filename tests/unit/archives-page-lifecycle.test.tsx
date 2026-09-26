import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

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

  it('keeps Restore and permanent delete available for a safe archived record', async () => {
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
    expect(
      screen.getByRole('button', {name: 'Permanently delete'})
    ).toBeEnabled();
  });

  it('keeps permanent delete discoverable but blocked and explains the exact impact', async () => {
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
    expect(screen.getByText('Deletion blocked')).toBeVisible();

    const deleteButton = screen.getByRole('button', {
      name: 'Permanently delete'
    });

    expect(deleteButton).toBeVisible();
    expect(deleteButton).toBeDisabled();

    expect(
      screen.getByText(/class subjects.*2/i)
    ).toBeVisible();

    expect(
      screen.getByText(/enrollments.*1/i)
    ).toBeVisible();
  });
});
