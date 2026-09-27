import {NextIntlClientProvider} from 'next-intl';
import {
  fireEvent,
  render,
  screen,
  within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import messages from '../../messages/en.json';
import arabicMessages from '../../messages/ar.json';

vi.mock(
  '@/features/weekly-updates/weekly-update.actions',
  () => ({
    initialWeeklyActionState: {
      status: 'idle',
      error: null
    },
    saveWeeklyUpdateAction: vi.fn()
  })
);

import {WeeklyUpdateForm} from '@/features/weekly-updates/weekly-update-form';
import {saveWeeklyUpdateAction} from '@/features/weekly-updates/weekly-update.actions';

const submission = {
  id: '',
  teacherId: '99999999-9999-4999-8999-999999999999',
  classSubjectId: '11111111-1111-4111-8111-111111111111',
  subjectGroupId: '44444444-4444-4444-8444-444444444444',
  classNameEn: 'Level 1',
  classNameAr: 'المستوى ١',
  subjectNameEn: 'Quran',
  subjectNameAr: 'القرآن',
  groupNameEn: 'Group A',
  groupNameAr: 'المجموعة أ',
  weekStart: '2026-09-21',
  status: 'DRAFT' as const,
  progressEn: null,
  progressAr: null,
  defaultPerformance: null,
  roster: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      nameEn: 'Ahmad Ali',
      nameAr: 'أحمد علي'
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      nameEn: 'Sara Noor',
      nameAr: 'سارة نور'
    }
  ],
  attendance: [],
  exceptions: []
};

function renderEnglish() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={messages}
    >
      <WeeklyUpdateForm
        locale="en"
        submission={submission}
      />
    </NextIntlClientProvider>
  );
}

describe('weekly update form', () => {
  it('marks the whole roster present with one action', async () => {
    const user = userEvent.setup();

    renderEnglish();

    await user.click(
      screen.getByRole('button', {
        name: 'Mark all present'
      })
    );

    expect(
      screen.getByRole('combobox', {
        name: 'Attendance — Ahmad Ali'
      })
    ).toHaveValue('PRESENT');

    expect(
      screen.getByRole('combobox', {
        name: 'Attendance — Sara Noor'
      })
    ).toHaveValue('PRESENT');
  });

  it('offers only Present and Absent attendance choices', () => {
    renderEnglish();

    for (const name of [
      'Attendance — Ahmad Ali',
      'Attendance — Sara Noor'
    ]) {
      const select = screen.getByRole('combobox', {name});

      const values = within(select)
        .getAllByRole('option')
        .map(
          (option) =>
            (option as HTMLOptionElement).value
        );

      expect(values).toEqual([
        '',
        'PRESENT',
        'ABSENT'
      ]);
    }
  });

  it('shows individual student controls directly in the roster', () => {
    renderEnglish();

    expect(
      screen.getByRole('combobox', {
        name: 'Individual performance — Ahmad Ali'
      })
    ).toBeVisible();

    expect(
      screen.getByRole('textbox', {
        name: 'Parent-facing comment (English) — Ahmad Ali'
      })
    ).toBeVisible();

    expect(
      screen.getByRole('textbox', {
        name: 'Parent-facing comment (Arabic) — Ahmad Ali'
      })
    ).toBeVisible();
  });

  it('uses an explicit student roster table inside the weekly form', () => {
    const {container} = renderEnglish();

    expect(
      container.querySelector('form.weekly-form')
    ).not.toBeNull();

    expect(screen.getByRole('table')).toBeVisible();

    expect(
      screen.getByRole('columnheader', {
        name: 'Student'
      })
    ).toBeVisible();

    expect(
      screen.getByRole('columnheader', {
        name: 'Attendance'
      })
    ).toBeVisible();

    expect(
      container.querySelector('.table-wrap')
    ).not.toBeNull();
  });

  it('labels the default-performance control', () => {
    renderEnglish();

    expect(
      screen.getByLabelText('Default performance')
    ).toBeVisible();
  });

  it('keeps navigation protection after a failed save', async () => {
    vi.mocked(saveWeeklyUpdateAction).mockResolvedValueOnce({
      status: 'error',
      error: 'save'
    });

    const user = userEvent.setup();

    renderEnglish();

    await user.click(
      screen.getByRole('button', {
        name: 'Mark all present'
      })
    );

    fireEvent.change(
      screen.getByLabelText(
        'What did you cover? (English)'
      ),
      {
        target: {
          value: 'Changed'
        }
      }
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Save draft'
      })
    );

    expect(
      await screen.findByText(messages.weekly.save)
    ).toBeVisible();

    const event = new Event(
      'beforeunload',
      {cancelable: true}
    );

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('renders Arabic student names and roster labels in RTL', () => {
    render(
      <div dir="rtl">
        <NextIntlClientProvider
          locale="ar"
          messages={arabicMessages}
        >
          <WeeklyUpdateForm
            locale="ar"
            readOnly
            submission={submission}
          />
        </NextIntlClientProvider>
      </div>
    );

    expect(
      screen.getByText('أحمد علي')
    ).toBeVisible();

    expect(
      screen.getByText('سارة نور')
    ).toBeVisible();

    expect(
      screen.getByRole('columnheader', {
        name: arabicMessages.weekly.attendance
      })
    ).toBeVisible();
  });
});
