import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {SetPasswordForm} from '@/app/[locale]/(auth)/set-password/set-password-form';

const state = vi.hoisted(() => ({
  role: 'ADMIN' as 'ADMIN' | 'TEACHER',
  replace: vi.fn(),
  refresh: vi.fn()
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({replace: state.replace, refresh: state.refresh})
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key
}));

vi.mock('@/lib/supabase/browser', () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      onAuthStateChange: () => ({data: {subscription: {unsubscribe() {}}}}),
      getSession: async () => ({data: {session: {user: {id: 'auth-user'}}}}),
      updateUser: async () => ({error: null}),
      getUser: async () => ({data: {user: {id: 'auth-user'}}, error: null})
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({data: {role: state.role, is_active: true}, error: null})
        })
      })
    })
  })
}));

async function setPassword() {
  render(<SetPasswordForm locale="en" />);
  const button = screen.getByRole('button', {name: 'setPassword'});
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.change(screen.getByLabelText('newPassword'), {target: {value: 'StrongPass123'}});
  fireEvent.click(button);
}

describe('password setup routing', () => {
  beforeEach(() => {
    state.role = 'ADMIN';
    state.replace.mockClear();
    state.refresh.mockClear();
  });

  it('sends an administrator to the dashboard after setting a password', async () => {
    await setPassword();
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith('/en/dashboard'));
  });

  it('sends a teacher to assigned groups after setting a password', async () => {
    state.role = 'TEACHER';
    await setPassword();
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith('/en/my-groups'));
  });
});
