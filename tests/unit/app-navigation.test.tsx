import {NextIntlClientProvider} from 'next-intl';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {AppNavigation} from '@/components/layout/app-navigation';
import arabicMessages from '../../messages/ar.json';
import englishMessages from '../../messages/en.json';

const navigationState = vi.hoisted(() => ({pathname: '/en/classes'}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigationState.pathname
}));

function renderNavigation(
  locale: 'en' | 'ar',
  capabilities: {isAdmin: boolean; teacherIds: string[]}
) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'ar' ? arabicMessages : englishMessages}
    >
      <AppNavigation capabilities={capabilities} />
    </NextIntlClientProvider>
  );
}

describe('AppNavigation', () => {
  it('groups administrator destinations by the approved information architecture', () => {
    navigationState.pathname = '/en/classes/class-1';
    renderNavigation('en', {isAdmin: true, teacherIds: []});

    expect(screen.getByRole('navigation', {name: 'Main navigation'})).toBeInTheDocument();
    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'Overview',
      'People',
      'School',
      'Reports',
      'Data',
      'Settings'
    ]);
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Students',
      'Guardians',
      'Teachers',
      'Administrators',
      'Classes & Subjects',
      'Teaching Assignments',
      'Reports',
      'Delivery status',
      'Export Data',
      'Archives',
      'School settings'
    ]);
    expect(screen.getByRole('link', {name: 'Classes & Subjects'})).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('heading', {name: 'My Teaching'})).not.toBeInTheDocument();
  });

  it('keeps teacher-only navigation focused on personal teaching', () => {
    navigationState.pathname = '/en/my-teaching';
    renderNavigation('en', {isAdmin: false, teacherIds: ['teacher-1']});

    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual(['My Teaching']);
    expect(screen.getByRole('link', {name: 'This Week'})).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', {name: 'History'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'My Profile'})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Students'})).not.toBeInTheDocument();
  });

  it('shows both grouped administrator navigation and My Teaching for dual capability', () => {
    navigationState.pathname = '/en/history';
    renderNavigation('en', {isAdmin: true, teacherIds: ['teacher-1']});

    expect(screen.getByRole('heading', {name: 'Overview'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'People'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'My Teaching'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'History'})).toHaveAttribute('aria-current', 'page');
  });

  it('uses translated grouped navigation in Arabic without parallel hardcoded labels', () => {
    navigationState.pathname = '/ar/students';
    renderNavigation('ar', {isAdmin: true, teacherIds: ['teacher-1']});

    expect(screen.getByRole('navigation', {name: 'التنقل الرئيسي'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'نظرة عامة'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'الأشخاص'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'المدرسة'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'البيانات'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'تدريسي'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'الطلاب'})).toHaveAttribute('aria-current', 'page');
  });

  it('opens the mobile drawer and closes it after choosing a destination', async () => {
    const user = userEvent.setup();
    navigationState.pathname = '/en/dashboard';
    renderNavigation('en', {isAdmin: true, teacherIds: []});

    await user.click(screen.getByRole('button', {name: 'Open navigation'}));
    const dialog = screen.getByRole('dialog', {name: 'Main navigation'});
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', {name: 'People'})).toBeInTheDocument();

    await user.click(within(dialog).getByRole('link', {name: 'Students'}));
    expect(screen.queryByRole('dialog', {name: 'Main navigation'})).not.toBeInTheDocument();
  });
});
