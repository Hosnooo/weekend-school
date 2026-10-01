import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {ReportEditForm} from '@/features/reports/report-edit-form';
import {ReportEmailReview} from '@/features/reports/report-email-review';

const state = {
  save: vi.fn(),
  preview: vi.fn()
};

vi.mock('@/features/reports/report-preview-frame', () => ({
  ReportPreviewFrame: ({html, title}: {html: string; title: string}) => (
    <div data-testid="preview-frame" data-title={title}>{html}</div>
  )
}));

function renderEditForm() {
  return render(
    <ReportEditForm
      cancelLabel="Cancel"
      saveAction={state.save}
      saveErrorLabel="Unable to save"
      saveLabel="Save & close"
    >
      <label>
        English
        <input defaultValue="Original" name="mainReportEn" />
      </label>
    </ReportEditForm>
  );
}

describe('Report Cycle local panel interactions', () => {
  beforeEach(() => {
    state.save.mockReset();
    state.preview.mockReset();
    window.location.hash = '';
  });

  it('saves in the background and closes locally', async () => {
    state.save.mockResolvedValue({ok: true, studentIds: ['student-1']});
    renderEditForm();

    const input = screen.getByLabelText('English') as HTMLInputElement;
    fireEvent.change(input, {target: {value: 'Saved value'}});
    fireEvent.click(screen.getByRole('button', {name: 'Save & close'}));

    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(window.location.hash).toBe('#report-edit-closed'));
  });

  it('Cancel restores the latest saved values without submitting', async () => {
    state.save.mockResolvedValue({ok: true, studentIds: ['student-1']});
    renderEditForm();

    const input = screen.getByLabelText('English') as HTMLInputElement;
    fireEvent.change(input, {target: {value: 'Saved value'}});
    fireEvent.click(screen.getByRole('button', {name: 'Save & close'}));
    await waitFor(() => expect(window.location.hash).toBe('#report-edit-closed'));

    state.save.mockClear();
    fireEvent.change(input, {target: {value: 'Unsaved value'}});
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(state.save).not.toHaveBeenCalled();
    expect(input.value).toBe('Saved value');
    expect(window.location.hash).toBe('#report-edit-closed');
  });

  it('changes the selected student and refreshes only Email Review without a submit button', async () => {
    state.preview.mockResolvedValueOnce({
      ok: true,
      preview: {
        studentId: 'student-2',
        recipients: ['two@example.com'],
        subject: 'Student Two report',
        html: '<p>Student Two</p>'
      }
    });

    render(
      <ReportEmailReview
        batchId="batch-1"
        initialPreview={{
          studentId: 'student-1',
          recipients: ['one@example.com'],
          subject: 'Student One report',
          html: '<p>Student One</p>'
        }}
        initialStudentId="student-1"
        labels={{
          emailReview: 'Email review',
          parentEmailSubject: 'Subject',
          parentEmailTo: 'To',
          previewUnavailable: 'Unavailable',
          selectStudent: 'Student'
        }}
        loadPreviewAction={state.preview}
        locale="en"
        students={[
          {studentId: 'student-1', studentName: 'Student One'},
          {studentId: 'student-2', studentName: 'Student Two'}
        ]}
      />
    );

    expect(screen.queryByRole('button', {name: /show email/i})).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Student'), {
      target: {value: 'student-2'}
    });

    await waitFor(() => expect(state.preview).toHaveBeenCalledWith({
      batchId: 'batch-1',
      locale: 'en',
      studentId: 'student-2'
    }));
    await waitFor(() => expect(screen.getByText('two@example.com')).toBeVisible());
    expect(screen.getByText('Student Two report')).toBeVisible();
    expect(screen.getByTestId('preview-frame')).toHaveTextContent('Student Two');
  });

  it('refreshes the currently selected email preview after a report panel saves', async () => {
    state.preview.mockResolvedValueOnce({
      ok: true,
      preview: {
        studentId: 'student-1',
        recipients: ['one@example.com'],
        subject: 'Updated subject',
        html: '<p>Updated body</p>'
      }
    });

    render(
      <ReportEmailReview
        batchId="batch-1"
        initialPreview={{
          studentId: 'student-1',
          recipients: ['one@example.com'],
          subject: 'Old subject',
          html: '<p>Old body</p>'
        }}
        initialStudentId="student-1"
        labels={{
          emailReview: 'Email review',
          parentEmailSubject: 'Subject',
          parentEmailTo: 'To',
          previewUnavailable: 'Unavailable',
          selectStudent: 'Student'
        }}
        loadPreviewAction={state.preview}
        locale="en"
        students={[{studentId: 'student-1', studentName: 'Student One'}]}
      />
    );

    window.dispatchEvent(new CustomEvent('report-cycle:saved'));

    await waitFor(() => expect(state.preview).toHaveBeenCalledWith({
      batchId: 'batch-1',
      locale: 'en',
      studentId: 'student-1'
    }));
    await waitFor(() => expect(screen.getByText('Updated subject')).toBeVisible());
    expect(screen.getByTestId('preview-frame')).toHaveTextContent('Updated body');
  });
});
