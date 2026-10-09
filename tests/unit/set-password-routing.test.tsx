import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {SetPasswordForm} from '@/app/[locale]/(auth)/set-password/set-password-form';

const state = vi.hoisted(() => ({
  isAdmin: true,
  teacherIds: [] as string[],
  replace: vi.fn(),
  refresh: vi.fn(),
  onAuthStateChange: vi.fn(),
  getSession: vi.fn(),
  verifyOtp: vi.fn()
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
      onAuthStateChange: state.onAuthStateChange,
      getSession: state.getSession,
      verifyOtp: state.verifyOtp,
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
    state.onAuthStateChange.mockReset();
    state.getSession.mockReset();
    state.verifyOtp.mockReset();
    state.verifyOtp.mockResolvedValue({data: {session: {user: {id: 'auth-user'}}}, error: null});
    state.onAuthStateChange.mockImplementation((callback: (_event: string, session: unknown) => void) => {
      callback('INITIAL_SESSION', {user: {id: 'auth-user'}});
      return {data: {subscription: {unsubscribe() {}}}};
    });
    state.getSession.mockResolvedValue({data: {session: {user: {id: 'auth-user'}}}});
    window.history.replaceState({}, '', '/en/set-password');
  });

  it('rejects an expired recovery link before an existing session can enable the form', async () => {
    window.history.replaceState(
      {},
      '',
      '/en/set-password#error=access_denied&error_code=otp_expired'
    );

    render(<SetPasswordForm locale="en" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('invalidInvitation');
    expect(state.onAuthStateChange).not.toHaveBeenCalled();
    expect(state.getSession).not.toHaveBeenCalled();
  });

  it('does not redeem a recovery token until the recipient confirms, even when already signed in', async () => {
    window.history.replaceState(
      {},
      '',
      '/en/set-password#token_hash=recovery-test-hash&type=recovery'
    );
    render(<SetPasswordForm locale="en" />);

    const button = await screen.findByRole('button', {name: 'verifyPasswordLink'});
    expect(state.verifyOtp).not.toHaveBeenCalled();
    expect(state.getSession).not.toHaveBeenCalled();
    expect(state.onAuthStateChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: 'setPassword'})).not.toBeInTheDocument();

    fireEvent.click(button);
    await waitFor(() => expect(state.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'recovery-test-hash',
      type: 'recovery'
    }));
    await waitFor(() => expect(screen.getByRole('button', {name: 'setPassword'})).toBeEnabled());
    expect(window.location.hash).toBe('');
  });

  it('keeps a failed token locked instead of reusing an existing browser session', async () => {
    state.verifyOtp.mockResolvedValueOnce({data: {session: null}, error: {code: 'otp_expired'}});
    window.history.replaceState({}, '', '/en/set-password#token_hash=expired-test-hash&type=recovery');

    render(<SetPasswordForm locale="en" />);
    fireEvent.click(await screen.findByRole('button', {name: 'verifyPasswordLink'}));

    expect(await screen.findByRole('alert')).toHaveTextContent('invalidInvitation');
    expect(state.getSession).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('verifies invitation hashes with the invite OTP type only after confirmation', async () => {
    window.history.replaceState({}, '', '/en/set-password#token_hash=invite-test-hash&type=invite');

    render(<SetPasswordForm locale="en" />);
    expect(state.verifyOtp).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', {name: 'verifyPasswordLink'}));

    await waitFor(() => expect(state.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'invite-test-hash',
      type: 'invite'
    }));
    await waitFor(() => expect(screen.getByRole('button', {name: 'setPassword'})).toBeEnabled());
  });

  it('rejects unrecognized token types without redeeming them', async () => {
    window.history.replaceState({}, '', '/en/set-password#token_hash=test-hash&type=magiclink');
    render(<SetPasswordForm locale="en" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('invalidInvitation');
    expect(state.verifyOtp).not.toHaveBeenCalled();
    expect(state.getSession).not.toHaveBeenCalled();
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
