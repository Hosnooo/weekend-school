import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {ArchivePanel} from '@/features/archives/archive-panel';
import {ExportPanel} from '@/features/exports/export-panel';

const archiveLabels = {
  title: 'Archived students',
  empty: 'No archived students',
  restore: 'Restore',
  viewHistory: 'View data/history',
  downloadData: 'Download data',
  downloadFirst: 'Download data first',
  permanentDelete: 'Permanently delete',
  deleteImpact: 'Deletion impact',
  memberships: 'Memberships',
  attendanceObservations: 'Attendance observations',
  attendanceResolutions: 'Attendance resolutions',
  comments: 'Comments',
  reports: 'Reports',
  emailDeliveries: 'Email deliveries',
  confirmation: 'Confirmation'
};

const exportLabels = {
  title: 'Export data',
  period: 'Period',
  thisWeek: 'This week',
  lastWeek: 'Last week',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  custom: 'Custom',
  allHistory: 'All history',
  start: 'Start',
  end: 'End',
  scope: 'Scope',
  school: 'School',
  class: 'Class',
  subject: 'Subject',
  group: 'Group',
  student: 'Student',
  teacher: 'Teacher',
  datasets: 'Datasets',
  students: 'Students',
  memberships: 'Memberships',
  attendance: 'Attendance',
  comments: 'Comments',
  reports: 'Reports',
  deliveries: 'Deliveries',
  csv: 'CSV files',
  pdfs: 'Finalized report PDFs',
  fileOptions: 'File options',
  submit: 'Create export'
};

describe('archives and exports admin panels', () => {
  it('shows archived-student recovery, history, download, impact, and permanent-delete controls', () => {
    render(<ArchivePanel
      labels={archiveLabels}
      locale="en"
      students={[{
        id: 'student-1',
        name: 'Amina Hassan',
        impact: {
          entityType: 'STUDENT',
          entityId: 'student-1',
          isArchived: true,
          counts: {
            memberships: 3,
            attendanceObservations: 8,
            attendanceResolutions: 1,
            comments: 2,
            reports: 4,
            emailDeliveries: 4
          }
        }
      }]}
    />);

    expect(screen.getByText('Amina Hassan')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Restore'})).toBeVisible();
    expect(screen.getByText('View data/history')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Download data'})).toBeVisible();
    expect(screen.getByText('Download data first')).toBeVisible();
    expect(screen.getByText('Memberships: 3')).toBeVisible();
    expect(screen.getByText('Reports: 4')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Permanently delete'})).toBeVisible();
  });

  it('organizes export configuration into clear period, scope, dataset, and file-option steps', () => {
    render(<ExportPanel
      labels={exportLabels}
      locale="en"
      options={{
        classes: [{id: 'class-1', label: 'Class 1'}],
        subjects: [{id: 'subject-1', label: 'Quran', classId: 'class-1'}],
        groups: [{id: 'group-1', label: 'Group A', classSubjectId: 'subject-1'}],
        students: [{id: 'student-1', label: 'Amina Hassan'}],
        teachers: [{id: 'teacher-1', label: 'Teacher One'}]
      }}
    />);

    expect(screen.getByRole('group', {name: 'Period'})).toBeVisible();
    expect(screen.getByRole('group', {name: 'Scope'})).toBeVisible();
    expect(screen.getByRole('group', {name: 'Datasets'})).toBeVisible();
    expect(screen.getByRole('group', {name: 'File options'})).toBeVisible();

    expect(screen.getByLabelText('CSV files')).toBeVisible();
    expect(screen.getByLabelText('Finalized report PDFs')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Create export'})).toBeVisible();
  });

  it('renders approved period, scope, dataset, CSV, and finalized-PDF controls', () => {
    render(<ExportPanel
      labels={exportLabels}
      locale="en"
      options={{
        classes: [{id: 'class-1', label: 'Class 1'}],
        subjects: [{id: 'subject-1', label: 'Quran', classId: 'class-1'}],
        groups: [{id: 'group-1', label: 'Group A', classSubjectId: 'subject-1'}],
        students: [{id: 'student-1', label: 'Amina Hassan'}],
        teachers: [{id: 'teacher-1', label: 'Teacher One'}]
      }}
    />);

    expect(screen.getByRole('option', {name: 'All history'})).toBeVisible();
    expect(screen.getByRole('option', {name: 'School'})).toBeVisible();
    expect(screen.getByRole('option', {name: 'Student'})).toBeVisible();
    expect(screen.getByRole('option', {name: 'Teacher'})).toBeVisible();
    expect(screen.getByLabelText('Students')).toBeChecked();
    expect(screen.getByLabelText('CSV files')).toBeVisible();
    expect(screen.getByLabelText('Finalized report PDFs')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Create export'})).toBeVisible();
  });
});
