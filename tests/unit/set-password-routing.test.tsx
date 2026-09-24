import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {SetPasswordForm} from '@/app/[locale]/(auth)/set-password/set-password-form';

const state = vi.hoisted(() => ({
  isAdmin: true,
  teacherIds: [] as string[],
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
          maybeSingle: async () => ({data: {is_active: true}, error: null})
        })
      })
    }),
    rpc: async (name: string) => {
      if (name === 'is_admin') return {data: state.isAdmin, error: null};
      if (name === 'current_teacher_ids') return {data: state.teacherIds, error: null};
      return {data: null, error: new Error(`Unexpected RPC: ${name}`)};
    }
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
    state.isAdmin = true;
    state.teacherIds = [];
    state.replace.mockClear();
    state.refresh.mockClear();
  });

  it('sends an administrator to the dashboard after setting a password', async () => {
    await setPassword();
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith('/en/dashboard'));
  });

  it('sends a teacher to My Teaching after setting a password', async () => {
    state.isAdmin = false;
    state.teacherIds = ['c0000000-0000-4000-8000-000000000002'];
    await setPassword();
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith('/en/my-teaching'));
  });
});
