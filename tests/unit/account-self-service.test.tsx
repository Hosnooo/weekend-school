import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {AccountWorkspace} from '@/features/profiles/account-workspace';
import {changeOwnNameAction, requestOwnEmailChangeAction, changeOwnPasswordAction} from '@/features/profiles/account.actions';

const state = vi.hoisted(() => ({refresh: vi.fn()}));
vi.mock('next/navigation', () => ({useRouter: () => ({refresh: state.refresh})}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key
}));
vi.mock('@/features/profiles/account.actions', () => ({
  changeOwnNameAction: vi.fn(),
  requestOwnEmailChangeAction: vi.fn(),
  changeOwnPasswordAction: vi.fn()
}));

describe('one personal My account screen', () => {
  beforeEach(() => {
    vi.mocked(changeOwnNameAction).mockReset().mockResolvedValue({status: 'success'});
    vi.mocked(requestOwnEmailChangeAction).mockReset().mockResolvedValue({status: 'sent'});
    vi.mocked(changeOwnPasswordAction).mockReset().mockResolvedValue({status: 'success'});
    state.refresh.mockClear();
  });

  function setup() {
    return render(<AccountWorkspace displayName="Amina" email="amina@example.com" />);
  }

  it('shows only current login identity; never exposes an existing password', () => {
    setup();
    expect(screen.getByDisplayValue('Amina')).toBeInTheDocument();
    expect(screen.getByText('amina@example.com')).toBeInTheDocument();
    for (const field of ['currentPassword', 'newPassword', 'confirmPassword']) {
      expect(screen.getByLabelText(field)).toHaveAttribute('type', 'password');
      expect(screen.getByLabelText(field)).toHaveValue('');
    }
    expect(screen.queryByText('old password')).not.toBeInTheDocument();
  });

  it('toggles only the typed password with accessible eye controls', () => {
    setup();
    const current = screen.getByLabelText('currentPassword');
    fireEvent.change(current, {target: {value: 'TypedPassword1'}});
    const show = screen.getByRole('button', {name: 'show currentpassword'});
    expect(current).toHaveAttribute('type', 'password');
    fireEvent.click(show);
    expect(current).toHaveAttribute('type', 'text');
    expect(current).toHaveValue('TypedPassword1');
    fireEvent.click(screen.getByRole('button', {name: 'hide currentpassword'}));
    expect(current).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('newPassword')).toHaveAttribute('type', 'password');
  });

  it('changes only the authenticated profile name and refreshes on success', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('displayName'), {target: {value: 'Amina B.'}});
    fireEvent.click(screen.getByRole('button', {name: 'changeName'}));
    await waitFor(() => expect(changeOwnNameAction).toHaveBeenCalledOnce());
    const form = vi.mocked(changeOwnNameAction).mock.calls[0][0];
    expect(form.get('displayName')).toBe('Amina B.');
    await waitFor(() => expect(state.refresh).toHaveBeenCalledOnce());
    expect(screen.getByRole('status')).toHaveTextContent('nameUpdated');
    expect(requestOwnEmailChangeAction).not.toHaveBeenCalled();
    expect(changeOwnPasswordAction).not.toHaveBeenCalled();
  });

  it('requests confirmed email change without altering the displayed current login', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('newEmail'), {target: {value: 'new@example.com'}});
    fireEvent.click(screen.getByRole('button', {name: 'changeEmail'}));
    await waitFor(() => expect(requestOwnEmailChangeAction).toHaveBeenCalledOnce());
    const form = vi.mocked(requestOwnEmailChangeAction).mock.calls[0][0];
    expect(form.get('newEmail')).toBe('new@example.com');
    expect(screen.getByText('amina@example.com')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('emailSent');
  });

  it('rejects a mismatch before sending any password to the server action', () => {
    setup();
    fireEvent.change(screen.getByLabelText('currentPassword'), {target: {value: 'CurrentPass1'}});
    fireEvent.change(screen.getByLabelText('newPassword'), {target: {value: 'NewPassword1'}});
    fireEvent.change(screen.getByLabelText('confirmPassword'), {target: {value: 'DifferentPass1'}});
    fireEvent.click(screen.getByRole('button', {name: 'changePassword'}));
    expect(screen.getByRole('alert')).toHaveTextContent('mismatch');
    expect(changeOwnPasswordAction).not.toHaveBeenCalled();
  });

  it('clears passwords after a successful own-account change', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('currentPassword'), {target: {value: 'CurrentPass1'}});
    fireEvent.change(screen.getByLabelText('newPassword'), {target: {value: 'NewPassword1'}});
    fireEvent.change(screen.getByLabelText('confirmPassword'), {target: {value: 'NewPassword1'}});
    fireEvent.click(screen.getByRole('button', {name: 'changePassword'}));
    await waitFor(() => expect(changeOwnPasswordAction).toHaveBeenCalledOnce());
    const form = vi.mocked(changeOwnPasswordAction).mock.calls[0][0];
    expect(form.get('currentPassword')).toBe('CurrentPass1');
    expect(form.get('newPassword')).toBe('NewPassword1');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('passwordChanged'));
    for (const field of ['currentPassword', 'newPassword', 'confirmPassword']) {
      expect(screen.getByLabelText(field)).toHaveValue('');
      expect(screen.getByLabelText(field)).toHaveAttribute('type', 'password');
    }
  });
});
