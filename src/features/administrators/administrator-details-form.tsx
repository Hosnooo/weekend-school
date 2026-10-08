'use client';

import {useActionState} from 'react';
import {FormFeedback} from '@/components/ui/form-feedback';
import type {ActionState} from '@/lib/validation/action-state';
import {initialActionState} from '@/lib/validation/action-state';
import {Link} from '@/i18n/navigation';

type Labels = {
  displayName: string;
  email: string;
  addHelp: string;
  emailAccessHelp: string;
  submit: string;
  cancel: string;
};

export function AdministratorDetailsForm({
  action,
  locale,
  labels,
  id,
  displayName = '',
  email = '',
  cancelHref
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  locale: string;
  labels: Labels;
  id?: string;
  displayName?: string;
  email?: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const editing = Boolean(id);
  return (
    <form action={formAction} className="record-form">
      <input name="locale" type="hidden" value={locale} />
      {id ? <input name="id" type="hidden" value={id} /> : null}
      <div className="form-grid">
        <label>
          <span>{labels.displayName}</span>
          <input
            autoComplete="name"
            defaultValue={displayName}
            maxLength={120}
            name="displayName"
            required
          />
        </label>
        <label>
          <span>{labels.email}</span>
          <input
            autoComplete="email"
            defaultValue={email}
            disabled={editing}
            name={editing ? undefined : 'email'}
            required={!editing}
            type="email"
          />
          {editing ? <span className="form-hint">{labels.emailAccessHelp}</span> : null}
        </label>
      </div>
      {!editing ? <p className="muted-text">{labels.addHelp}</p> : null}
      <FormFeedback state={state} />
      <div className="form-actions">
        <button className="button button-primary" disabled={pending} type="submit">
          {labels.submit}
        </button>
        <Link className="button button-secondary action-link" href={cancelHref}>
          {labels.cancel}
        </Link>
      </div>
    </form>
  );
}
