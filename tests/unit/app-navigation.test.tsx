import {NextIntlClientProvider} from 'next-intl';
import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {AppNavigation} from '@/components/layout/app-navigation';
import englishMessages from '../../messages/en.json';

const navigationState = vi.hoisted(() => ({pathname: '/en/classes'}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigationState.pathname
}));

describe('AppNavigation', () => {
  it('renders the focused teacher navigation without administrative destinations', () => {
    navigationState.pathname = '/en/my-teaching';
    render(
      <NextIntlClientProvider locale="en" messages={englishMessages}>
        <AppNavigation capabilities={{isAdmin: false, teacherIds: ['teacher-1']}} />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('heading', {name: 'My Teaching'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'This Week'})).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', {name: 'History'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'My Profile'})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Students'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Administrators'})).not.toBeInTheDocument();
  });

  it('renders the approved administrator destinations in a discoverable Administration section', () => {
    navigationState.pathname = '/en/classes/class-1';
    render(
      <NextIntlClientProvider locale="en" messages={englishMessages}>
        <AppNavigation capabilities={{isAdmin: true, teacherIds: []}} />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('navigation', {name: 'Main navigation'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Administration'})).toBeInTheDocument();
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Students',
      'Guardians',
      'Teachers',
      'Administrators',
      'Classes & Subjects',
      'Teaching Assignments',
      'Reports',
      'Export Data',
      'Archives',
      'Settings'
    ]);
    expect(screen.getByRole('link', {name: 'Classes & Subjects'})).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', {name: 'Dashboard'})).not.toHaveAttribute('aria-current');
  });

  it('visibly separates Administration from personal teaching for a dual-capability account', () => {
    navigationState.pathname = '/en/my-teaching';
    render(
      <NextIntlClientProvider locale="en" messages={englishMessages}>
        <AppNavigation capabilities={{isAdmin: true, teacherIds: ['teacher-1']}} />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('heading', {name: 'Administration'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'My Teaching'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Dashboard'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'This Week'})).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', {name: 'History'})).toBeInTheDocument();
  });
});
