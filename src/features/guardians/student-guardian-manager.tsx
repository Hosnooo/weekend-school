'use client';

import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import {
  addStudentGuardianAction,
  linkExistingStudentGuardianAction,
  unlinkStudentGuardianAction,
  updateStudentGuardianAction
} from '@/features/guardians/guardian.actions';
import type {
  GuardianListItem,
  StudentGuardianLink
} from '@/features/guardians/guardian.types';
import type {Locale} from '@/i18n/config';
import {initialActionState} from '@/lib/validation/action-state';

function GuardianEditor({
  locale,
  studentId,
  guardian
}: {
  locale: Locale;
  studentId: string;
  guardian: StudentGuardianLink;
}) {
  const t = useTranslations('guardians');
  const common = useTranslations('common');
  const [state, action, pending] = useActionState(
    updateStudentGuardianAction,
    initialActionState
  );

  return (
    <details>
      <summary>{t('editGuardian')}</summary>
      <form action={action} className="record-form">
        <input name="locale" type="hidden" value={locale} />
        <input name="studentId" type="hidden" value={studentId} />
        <input name="guardianId" type="hidden" value={guardian.id} />
        <input
          name="reportLanguage"
          type="hidden"
          value={guardian.reportLanguage}
        />

        <div className="form-grid">
          <label>
            {t('name')}
            <input defaultValue={guardian.name} name="name" required />
          </label>

          <label>
            {t('email')}
            <input
              autoComplete="email"
              defaultValue={guardian.email}
              name="email"
              required
              type="email"
            />
          </label>

          <label>
            {t('phone')}
            <input
              autoComplete="tel"
              defaultValue={guardian.phone ?? ''}
              name="phone"
              required
              type="tel"
            />
          </label>

          <label>
            <input
              defaultChecked={guardian.isPrimary}
              name="isPrimary"
              type="checkbox"
            />{' '}
            {t('primaryGuardian')}
          </label>

          <label>
            <input
              defaultChecked={guardian.receivesReports}
              name="receivesReports"
              type="checkbox"
            />{' '}
            {t('receivesReports')}
          </label>
        </div>

        <p className="field-help">{t('sharedContactHelp')}</p>
        <FormFeedback state={state} />

        <Button disabled={pending} type="submit">
          {pending ? common('saving') : common('save')}
        </Button>
      </form>
    </details>
  );
}

function ExistingGuardianLinkForm({
  guardian,
  locale,
  studentId,
  isFirstGuardian
}: {
  guardian: GuardianListItem;
  locale: Locale;
  studentId: string;
  isFirstGuardian: boolean;
}) {
  const t = useTranslations('guardians');
  const common = useTranslations('common');
  const [state, action, pending] = useActionState(
    linkExistingStudentGuardianAction,
    initialActionState
  );

  return (
    <div className="record-card stack-list">
      <div>
        <strong>{guardian.name}</strong>{' '}
        {!guardian.isActive ? (
          <Badge variant="warning">{t('archived')}</Badge>
        ) : null}
      </div>

      <div>{guardian.email}</div>

      <div>
        <strong>{t('phone')}:</strong>{' '}
        {guardian.phone ?? common('none')}
      </div>

      <form action={action} className="record-form">
        <input name="locale" type="hidden" value={locale} />
        <input name="studentId" type="hidden" value={studentId} />
        <input name="guardianId" type="hidden" value={guardian.id} />

        <div className="form-grid">
          <label>
            <input
              defaultChecked={isFirstGuardian}
              name="isPrimary"
              type="checkbox"
            />{' '}
            {t('primaryGuardian')}
          </label>

          <label>
            <input
              defaultChecked
              name="receivesReports"
              type="checkbox"
            />{' '}
            {t('receivesReports')}
          </label>
        </div>

        <FormFeedback state={state} />

        <Button disabled={pending} type="submit">
          {pending
            ? common('saving')
            : guardian.isActive
              ? t('linkGuardian')
              : t('restoreAndLink')}
        </Button>
      </form>
    </div>
  );
}

function ExistingGuardianLinker({
  availableGuardians,
  guardians,
  locale,
  studentId
}: {
  availableGuardians: GuardianListItem[];
  guardians: StudentGuardianLink[];
  locale: Locale;
  studentId: string;
}) {
  const t = useTranslations('guardians');
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLocaleLowerCase();

  const matchingGuardians = availableGuardians.filter((guardian) => {
    if (!normalizedQuery) return true;

    return (
      guardian.name.toLocaleLowerCase().includes(normalizedQuery) ||
      guardian.email.toLocaleLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <details>
      <summary>{t('linkExistingGuardian')}</summary>

      <div className="record-form">
        <label>
          {t('searchExistingGuardian')}
          <input
            name="guardianSearch"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchExistingGuardianPlaceholder')}
            type="search"
            value={query}
          />
        </label>

        <p className="field-help">
          {t('searchExistingGuardianHelp')}
        </p>

        {availableGuardians.length === 0 ? (
          <p>{t('noAvailableGuardians')}</p>
        ) : matchingGuardians.length === 0 ? (
          <p>{t('noGuardianSearchResults')}</p>
        ) : (
          <div className="stack-list">
            {matchingGuardians.map((guardian) => (
              <ExistingGuardianLinkForm
                guardian={guardian}
                isFirstGuardian={guardians.length === 0}
                key={guardian.id}
                locale={locale}
                studentId={studentId}
              />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

export function StudentGuardianManager({
  locale,
  studentId,
  guardians,
  availableGuardians
}: {
  locale: Locale;
  studentId: string;
  guardians: StudentGuardianLink[];
  availableGuardians: GuardianListItem[];
}) {
  const t = useTranslations('guardians');
  const common = useTranslations('common');

  const [state, action, pending] = useActionState(
    addStudentGuardianAction,
    initialActionState
  );

  return (
    <div className="stack-list">
      {guardians.length === 0 ? (
        <p>{t('noLinked')}</p>
      ) : (
        <div className="stack-list">
          {guardians.map((guardian) => (
            <div className="record-card stack-list" key={guardian.id}>
              <div>
                <strong>{guardian.name}</strong>{' '}
                {guardian.isPrimary ? (
                  <Badge variant="info">{t('primaryGuardian')}</Badge>
                ) : null}
              </div>

              <div>{guardian.email}</div>

              <div>
                <strong>{t('phone')}:</strong>{' '}
                {guardian.phone ?? common('none')}
              </div>

              {guardian.receivesReports ? (
                <Badge variant="success">{t('receivesReports')}</Badge>
              ) : null}

              <GuardianEditor
                guardian={guardian}
                locale={locale}
                studentId={studentId}
              />

              <form
                action={unlinkStudentGuardianAction}
                onSubmit={(event) => {
                  if (
                    !window.confirm(
                      t('removeGuardianConfirm', {
                        name: guardian.name
                      })
                    )
                  ) {
                    event.preventDefault();
                  }
                }}
              >
                <input name="locale" type="hidden" value={locale} />
                <input name="studentId" type="hidden" value={studentId} />
                <input name="guardianId" type="hidden" value={guardian.id} />

                <Button type="submit" variant="secondary">
                  {t('removeGuardianFromStudent')}
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}

      <ExistingGuardianLinker
        availableGuardians={availableGuardians}
        guardians={guardians}
        locale={locale}
        studentId={studentId}
      />

      <details>
        <summary>{t('addNewGuardian')}</summary>

        <form action={action} className="record-form">
          <input name="locale" type="hidden" value={locale} />
          <input name="studentId" type="hidden" value={studentId} />
          <input name="reportLanguage" type="hidden" value="both" />

          <div className="form-grid">
            <label>
              {t('name')}
              <input name="name" required />
            </label>

            <label>
              {t('email')}
              <input
                autoComplete="email"
                name="email"
                required
                type="email"
              />
            </label>

            <label>
              {t('phone')}
              <input
                autoComplete="tel"
                name="phone"
                required
                type="tel"
              />
            </label>

            <label>
              <input
                defaultChecked={guardians.length === 0}
                name="isPrimary"
                type="checkbox"
              />{' '}
              {t('primaryGuardian')}
            </label>

            <label>
              <input
                defaultChecked
                name="receivesReports"
                type="checkbox"
              />{' '}
              {t('receivesReports')}
            </label>
          </div>

          <FormFeedback state={state} />

          <Button disabled={pending} type="submit">
            {pending ? common('saving') : t('addNewGuardian')}
          </Button>
        </form>
      </details>
    </div>
  );
}
