'use client';

import {useState, type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {FormField} from '@/components/ui/form-field';
import {Input} from '@/components/ui/input';
import {changeOwnNameAction, requestOwnEmailChangeAction, changeOwnPasswordAction} from './account.actions';
import {ownEmailSchema, ownNameSchema, validateOwnPassword, type AccountResult} from './account.schema';
import styles from './account-workspace.module.css';

type SecretField = 'currentPassword' | 'newPassword' | 'confirmPassword';

function PasswordInput({id, label, value, setValue, busy, revealed, toggle, autoComplete}: {
  id: SecretField; label: string; value: string; setValue: (value: string) => void;
  busy: boolean; revealed: boolean; toggle: () => void; autoComplete: string;
}) {
  const t = useTranslations('account');
  return (
    <FormField htmlFor={id} label={label} required>
      <div className={styles.field}>
        <Input
          id={id} name={id} type={revealed ? 'text' : 'password'}
          autoComplete={autoComplete} value={value} disabled={busy} required
          minLength={id === 'newPassword' ? 8 : undefined}
          maxLength={id === 'newPassword' ? 128 : undefined}
          onChange={(e) => setValue(e.currentTarget.value)}
        />
        <button
          type="button" className={styles.eye} onClick={toggle} disabled={busy}
          aria-label={(revealed ? t('hide') : t('show')) + ' ' + label.toLowerCase()}
          aria-pressed={revealed}
        >
          {revealed ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
              <path d="M9.9 5.2A11.3 11.3 0 0112 5c5 0 8.5 4 10 7a13.2 13.2 0 01-3.3 4.3M6.1 6.1C4.5 7.5 3 9.5 2 12c1.5 3 5 7 10 7a10.8 10.8 0 004.3-.9" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </FormField>
  );
}

export function AccountWorkspace({displayName, email}: {displayName: string; email: string}) {
  const t = useTranslations('account');
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [newEmail, setNewEmail] = useState('');
  const [passwords, setPasswords] = useState<Record<SecretField, string>>({
    currentPassword: '', newPassword: '', confirmPassword: ''
  });
  const [visible, setVisible] = useState<Record<SecretField, boolean>>({
    currentPassword: false, newPassword: false, confirmPassword: false
  });
  const [busy, setBusy] = useState<'name' | 'email' | 'password' | null>(null);
  const [nameResult, setNameResult] = useState<AccountResult | null>(null);
  const [emailResult, setEmailResult] = useState<AccountResult | null>(null);
  const [passwordResult, setPasswordResult] = useState<AccountResult | null>(null);

  async function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const parsed = ownNameSchema.safeParse(name);
    if (!parsed.success) {setNameResult({status: 'error', reason: 'nameInvalid'}); return;}
    setBusy('name'); setNameResult(null);
    const form = new FormData(); form.set('displayName', parsed.data);
    try {
      const result = await changeOwnNameAction(form);
      setNameResult(result);
      if (result.status === 'success') router.refresh();
    } catch {setNameResult({status: 'error', reason: 'nameUnavailable'});}
    finally {setBusy(null);}
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const parsed = ownEmailSchema.safeParse(newEmail);
    if (!parsed.success) {setEmailResult({status: 'error', reason: 'invalidEmail'}); return;}
    setBusy('email'); setEmailResult(null);
    const form = new FormData(); form.set('newEmail', parsed.data);
    try {
      const result = await requestOwnEmailChangeAction(form);
      setEmailResult(result);
      if (result.status === 'sent') setNewEmail('');
    } catch {setEmailResult({status: 'error', reason: 'emailUnavailable'});}
    finally {setBusy(null);}
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const parsed = validateOwnPassword(passwords);
    if (!parsed.success) {setPasswordResult({status: 'error', reason: parsed.reason}); return;}
    setBusy('password'); setPasswordResult(null);
    const form = new FormData();
    Object.entries(passwords).forEach(([name, value]) => form.set(name, value));
    try {
      const result = await changeOwnPasswordAction(form);
      setPasswordResult(result);
      if (result.status === 'success') {
        setPasswords({currentPassword: '', newPassword: '', confirmPassword: ''});
        setVisible({currentPassword: false, newPassword: false, confirmPassword: false});
      }
    } catch {setPasswordResult({status: 'error', reason: 'passwordUnavailable'});}
    finally {setBusy(null);}
  }

  return (
    <div className={styles.stack}>
      <section className="settings-section-card">
        <div className={styles.panel}>
          <h2>{t('identity')}</h2>
          <p className={styles.help}>{t('identityHelp')}</p>
          <form className={styles.form} onSubmit={(event) => void submitName(event)}>
            <FormField htmlFor="account-display-name" label={t('displayName')} required>
              <Input id="account-display-name" name="displayName" value={name}
                minLength={2} maxLength={100} disabled={busy !== null} required
                onChange={(event) => setName(event.currentTarget.value)} />
            </FormField>
            {nameResult ? <p className={nameResult.status === 'success' ? 'form-success' : 'form-error'}
              role={nameResult.status === 'success' ? 'status' : 'alert'}>
              {t(nameResult.status === 'error' ? nameResult.reason : 'nameUpdated')}
            </p> : null}
            <div><Button disabled={busy !== null} type="submit">{busy === 'name' ? t('saving') : t('changeName')}</Button></div>
          </form>
        </div>
      </section>
      <section className="settings-section-card">
        <div className={styles.panel}>
          <h2>{t('loginIdentity')}</h2>
          <p><strong>{t('email')}:</strong> <span dir="ltr">{email}</span></p>
          <p className={styles.help}>{t('emailHelp')}</p>
          <form className={styles.form} onSubmit={(event) => void submitEmail(event)}>
            <FormField htmlFor="account-new-email" label={t('newEmail')} required>
              <Input id="account-new-email" name="newEmail" type="email" autoComplete="email"
                value={newEmail} disabled={busy !== null} maxLength={254} required
                onChange={(event) => setNewEmail(event.currentTarget.value)} />
            </FormField>
            {emailResult ? <p className={emailResult.status === 'sent' ? 'form-success' : 'form-error'}
              role={emailResult.status === 'sent' ? 'status' : 'alert'}>
              {t(emailResult.status === 'sent' ? 'emailSent' :
                emailResult.status === 'error' ? emailResult.reason : 'emailSent')}
            </p> : null}
            <div><Button disabled={busy !== null} type="submit">{busy === 'email' ? t('saving') : t('changeEmail')}</Button></div>
          </form>
        </div>
      </section>
      <section className="settings-section-card">
        <div className={styles.panel}>
          <h2>{t('security')}</h2>
          <p className={styles.help}>{t('securityHelp')}</p>
          <form className={styles.form} onSubmit={(event) => void submitPassword(event)}>
            {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((field) => (
              <PasswordInput key={field} id={field} label={t(field)} value={passwords[field]}
                setValue={(value) => setPasswords((previous) => ({...previous, [field]: value}))}
                busy={busy !== null} revealed={visible[field]}
                toggle={() => setVisible((previous) => ({...previous, [field]: !previous[field]}))}
                autoComplete={field === 'currentPassword' ? 'current-password' : 'new-password'} />
            ))}
            <p className={styles.help}>{t('requirements')}</p>
            {passwordResult ? <p className={passwordResult.status === 'success' ? 'form-success' : 'form-error'}
              role={passwordResult.status === 'success' ? 'status' : 'alert'}>
              {t(passwordResult.status === 'success' ? 'passwordChanged' :
                passwordResult.status === 'error' ? passwordResult.reason : 'passwordChanged')}
            </p> : null}
            <div><Button disabled={busy !== null} type="submit">{busy === 'password' ? t('saving') : t('changePassword')}</Button></div>
          </form>
        </div>
      </section>
    </div>
  );
}
