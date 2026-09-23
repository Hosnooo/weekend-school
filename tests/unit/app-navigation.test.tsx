import {NextIntlClientProvider} from 'next-intl';
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {AppNavigation} from '@/components/layout/app-navigation';
import englishMessages from '../../messages/en.json';

describe('AppNavigation', () => {
  it('renders teacher navigation without administrative destinations', () => {
    render(
      <NextIntlClientProvider locale="en" messages={englishMessages}>
        <AppNavigation role="TEACHER" />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('link', {name: 'My Teaching'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'History'})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Students'})).not.toBeInTheDocument();
  });

  it('renders exactly the approved admin navigation in order', () => {
    render(
      <NextIntlClientProvider locale="en" messages={englishMessages}>
        <AppNavigation role="ADMIN" />
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
  });
});
