import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {ForgotPasswordForm} from '@/app/[locale]/(auth)/forgot-password/forgot-password-form';
import {LoginForm} from '@/app/[locale]/(auth)/login/login-form';
import {SetPasswordForm} from '@/app/[locale]/(auth)/set-password/set-password-form';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({replace: vi.fn(), refresh: vi.fn()})
}));

vi.mock('@/app/[locale]/(auth)/login/actions', () => ({
  loginAction: async () => ({error: null})
}));

vi.mock('@/app/[locale]/(auth)/forgot-password/actions', () => ({
  requestRecoveryAction: async () => ({status: 'idle'})
}));

vi.mock('@/lib/supabase/browser', () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      onAuthStateChange: () => ({data: {subscription: {unsubscribe() {}}}}),
      getSession: async () => ({data: {session: {user: {id: 'auth-user'}}}}),
      exchangeCodeForSession: async () => ({data: {session: {user: {id: 'auth-user'}}}}),
      setSession: async () => ({data: {session: {user: {id: 'auth-user'}}}}),
      updateUser: async () => ({error: null}),
      getUser: async () => ({data: {user: {id: 'auth-user'}}, error: null})
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({data: {role: 'TEACHER', is_active: true}, error: null})
        })
      })
    })
  })
}));

function expectSharedField(label: string) {
  const input = screen.getByLabelText(label);
  expect(input).toBeVisible();
  expect(input).toHaveClass('text-input');
}

describe('auth form field styling and accessibility', () => {
  it('uses the shared visible input primitive on login fields', () => {
    render(<LoginForm locale="en" />);
    expectSharedField('email');
    expectSharedField('password');
  });

  it('uses the shared visible input primitive on password recovery', () => {
    render(<ForgotPasswordForm locale="en" />);
    expectSharedField('email');
  });

  it('uses the shared visible input primitive on password setup', () => {
    render(<SetPasswordForm locale="en" />);
    expectSharedField('newPassword');
  });
});
