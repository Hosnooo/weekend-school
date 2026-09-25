import type {ReactNode} from 'react';
import {NextIntlClientProvider} from 'next-intl';
import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import messages from '../../messages/en.json';
import arabicMessages from '../../messages/ar.json';
import type {TeachingAssignment, TeachingClassSubject} from '@/features/teaching-assignments/teaching-assignment.types';

vi.mock('@/features/teaching-assignments/teaching-assignment.actions', () => ({
  createTeachingAssignmentAction: vi.fn(),
  updateTeachingAssignmentAction: vi.fn(),
  createTeachingAssignmentMutationAction: vi.fn(),
  updateTeachingAssignmentMutationAction: vi.fn(),
  deleteTeachingAssignmentAction: vi.fn()
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({children, ...props}: {children: ReactNode; href: string; className?: string}) => <a {...props}>{children}</a>
}));

import {
  createTeachingAssignmentMutationAction,
  deleteTeachingAssignmentAction,
  updateTeachingAssignmentMutationAction
} from '@/features/teaching-assignments/teaching-assignment.actions';
import {TeachingAssignmentWorkspace} from '@/features/teaching-assignments/teaching-assignment-workspace';

const teacherId = '11111111-1111-4111-8111-111111111111';
const quranId = '22222222-2222-4222-8222-222222222222';
const arabicId = '33333333-3333-4333-8333-333333333333';
const quranGroupA = '44444444-4444-4444-8444-444444444441';
const quranGroupB = '44444444-4444-4444-8444-444444444442';

const classSubjects: TeachingClassSubject[] = [
  {
    id: quranId,
    classId: '55555555-5555-4555-8555-555555555555',
    classNameEn: 'Level 1',
    classNameAr: 'المستوى الأول',
    subjectNameEn: 'Quran',
    subjectNameAr: 'القرآن',
    groups: [
      {id: quranGroupA, nameEn: 'Quran A', nameAr: 'قرآن أ', isActive: true},
      {id: quranGroupB, nameEn: 'Quran B', nameAr: 'قرآن ب', isActive: true}
    ]
  },
  {
    id: arabicId,
    classId: '55555555-5555-4555-8555-555555555555',
    classNameEn: 'Level 1',
    classNameAr: 'المستوى الأول',
    subjectNameEn: 'Arabic',
    subjectNameAr: 'العربية',
    groups: []
  }
];

const assignments: TeachingAssignment[] = [
  {id: '66666666-6666-4666-8666-666666666661', teacherId, classSubjectId: quranId, subjectGroupId: quranGroupA, startsOn: '2026-09-01', endsOn: null},
  {id: '66666666-6666-4666-8666-666666666662', teacherId, classSubjectId: arabicId, subjectGroupId: null, startsOn: '2026-10-01', endsOn: null},
  {id: '66666666-6666-4666-8666-666666666663', teacherId, classSubjectId: quranId, subjectGroupId: quranGroupB, startsOn: '2026-08-01', endsOn: '2026-08-31'}
];

function renderWorkspace(locale: 'en' | 'ar' = 'en') {
  return render(
    <div dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? arabicMessages : messages}>
        <TeachingAssignmentWorkspace assignments={assignments} classSubjects={classSubjects} locale={locale} teacherId={teacherId} today="2026-09-24" />
      </NextIntlClientProvider>
    </div>
  );
}

async function openCurrentActions(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', {name: /Actions for Level 1.*Quran.*Quran A/i}));
  return screen.getByRole('menu');
}

describe('teaching assignment workspace reference CRUD flow', () => {
  beforeEach(() => {
    vi.mocked(createTeachingAssignmentMutationAction).mockReset().mockResolvedValue({ok: true});
    vi.mocked(updateTeachingAssignmentMutationAction).mockReset().mockResolvedValue({ok: true});
    vi.mocked(deleteTeachingAssignmentAction).mockReset().mockResolvedValue({ok: true});
  });

  it('shows only the active Current tab panel initially', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    expect(screen.getByRole('tab', {name: 'Current'})).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Quran A')).toBeVisible();
    expect(screen.queryByText(/Level 1.*Arabic/)).not.toBeInTheDocument();
    expect(screen.queryByText('Quran B')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', {name: 'Upcoming'}));
    expect(screen.getByText(/Level 1.*Arabic/)).toBeVisible();
    expect(screen.queryByText('Quran A')).not.toBeInTheDocument();
  });

  it('does not render date inputs until Edit dates is chosen', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    expect(screen.queryByLabelText('Starts on')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Ends on (optional)')).not.toBeInTheDocument();
    const menu = await openCurrentActions(user);
    await user.click(within(menu).getByRole('menuitem', {name: 'Edit dates'}));
    expect(screen.getByLabelText('Starts on')).toHaveValue('2026-09-01');
    expect(screen.getByLabelText('Ends on (optional)')).toHaveValue('');
  });

  it('opens Add assignment in a focused dialog', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', {name: 'Add assignment'}));
    const dialog = screen.getByRole('dialog', {name: 'Add assignment'});
    expect(dialog).toBeVisible();
    expect(within(dialog).getByLabelText('Class')).toBeVisible();
    expect(within(dialog).getByLabelText('Subject')).toBeVisible();
    expect(within(dialog).getByLabelText('Scope')).toBeVisible();
    expect(within(dialog).getByLabelText('Starts on')).toBeVisible();
    expect(within(dialog).getByLabelText('Ends on (optional)')).toBeVisible();
    expect(within(dialog).getByLabelText('Class')).toHaveFocus();
  });

  it('offers Edit dates, End assignment, and Delete assignment in the row menu', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const menu = await openCurrentActions(user);
    expect(within(menu).getByRole('menuitem', {name: 'Edit dates'})).toBeVisible();
    expect(within(menu).getByRole('menuitem', {name: 'End assignment'})).toBeVisible();
    expect(within(menu).getByRole('menuitem', {name: 'Delete assignment'})).toBeVisible();
  });

  it('cancels edit without mutating the rendered dates', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const menu = await openCurrentActions(user);
    await user.click(within(menu).getByRole('menuitem', {name: 'Edit dates'}));
    await user.clear(screen.getByLabelText('Starts on'));
    await user.type(screen.getByLabelText('Starts on'), '2026-09-05');
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(screen.queryByLabelText('Starts on')).not.toBeInTheDocument();
    expect(screen.getByText(/2026-09-01/)).toBeVisible();
  });

  it('renders overlap and protected-history errors with different translated messages', async () => {
    const user = userEvent.setup();
    vi.mocked(updateTeachingAssignmentMutationAction).mockResolvedValueOnce({ok: false, error: 'overlap'});
    vi.mocked(deleteTeachingAssignmentAction).mockResolvedValueOnce({ok: false, error: 'protected-history'});
    renderWorkspace();

    let menu = await openCurrentActions(user);
    await user.click(within(menu).getByRole('menuitem', {name: 'Edit dates'}));
    await user.click(screen.getByRole('button', {name: 'Save dates'}));
    const overlap = await screen.findByRole('alert');
    expect(overlap).toHaveTextContent('This assignment overlaps an existing assignment for the same teaching context.');

    menu = await openCurrentActions(user);
    await user.click(within(menu).getByRole('menuitem', {name: 'Delete assignment'}));
    const dialog = screen.getByRole('dialog', {name: 'Delete assignment'});
    await user.click(within(dialog).getByRole('button', {name: 'Delete assignment'}));
    const protectedHistory = await screen.findByRole('alert');
    expect(protectedHistory).toHaveTextContent('This assignment cannot be deleted because submitted teaching history depends on it.');
    expect(protectedHistory.textContent).not.toBe(overlap.textContent);
  });

  it('keeps Delete visible and explains the blocker after protected history prevents deletion', async () => {
    const user = userEvent.setup();
    vi.mocked(deleteTeachingAssignmentAction).mockResolvedValueOnce({ok: false, error: 'protected-history'});
    renderWorkspace();
    let menu = await openCurrentActions(user);
    await user.click(within(menu).getByRole('menuitem', {name: 'Delete assignment'}));
    const dialog = screen.getByRole('dialog', {name: 'Delete assignment'});
    await user.click(within(dialog).getByRole('button', {name: 'Delete assignment'}));
    expect(await screen.findByText('This assignment cannot be deleted because submitted teaching history depends on it.')).toBeVisible();
    menu = await openCurrentActions(user);
    expect(within(menu).getByRole('menuitem', {name: 'Delete assignment'})).toBeVisible();
  });

  it('keeps the confirmation open until an async delete mutation finishes', async () => {
    const user = userEvent.setup();
    let resolveDelete!: (result: {ok: true}) => void;
    vi.mocked(deleteTeachingAssignmentAction).mockImplementationOnce(
      () => new Promise((resolve) => { resolveDelete = resolve; })
    );
    renderWorkspace();

    const menu = await openCurrentActions(user);
    await user.click(within(menu).getByRole('menuitem', {name: 'Delete assignment'}));
    const dialog = screen.getByRole('dialog', {name: 'Delete assignment'});
    await user.click(within(dialog).getByRole('button', {name: 'Delete assignment'}));

    expect(dialog).toBeVisible();
    resolveDelete({ok: true});
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Delete assignment'})).not.toBeInTheDocument());
  });

  it('uses structured rows rather than legacy floating record cards', () => {
    const {container} = renderWorkspace();
    expect(container.querySelector('.record-card')).toBeNull();
  });
});
