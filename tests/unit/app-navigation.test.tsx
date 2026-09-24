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
  it('renders teacher navigation without administrative destinations', () => {
    navigationState.pathname = '/en/my-teaching';
    render(
      <NextIntlClientProvider locale="en" messages={englishMessages}>
        <AppNavigation capabilities={{isAdmin: false, teacherIds: ['teacher-1']}} />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('link', {name: 'My Teaching'})).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', {name: 'History'})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Students'})).not.toBeInTheDocument();
  });

  it('renders exactly the approved admin navigation in order and marks the current section', () => {
    navigationState.pathname = '/en/classes/class-1';
    render(
      <NextIntlClientProvider locale="en" messages={englishMessages}>
        <AppNavigation capabilities={{isAdmin: true, teacherIds: []}} />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('navigation', {name: 'Main navigation'})).toBeInTheDocument();
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Classes',
      'Students',
      'Teachers',
      'Reports',
      'Settings'
    ]);
    expect(screen.getByRole('link', {name: 'Classes'})).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', {name: 'Dashboard'})).not.toHaveAttribute('aria-current');
  });

  it('renders both navigation surfaces for a dual-capability account', () => {
    navigationState.pathname = '/en/my-teaching';
    render(
      <NextIntlClientProvider locale="en" messages={englishMessages}>
        <AppNavigation capabilities={{isAdmin: true, teacherIds: ['teacher-1']}} />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('link', {name: 'Dashboard'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'My Teaching'})).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', {name: 'History'})).toBeInTheDocument();
  });
});
