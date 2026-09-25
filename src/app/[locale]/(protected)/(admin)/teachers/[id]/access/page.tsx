import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Alert} from '@/components/ui/alert';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {PageHeader} from '@/components/ui/page-header';
import {SectionHeader} from '@/components/ui/section-header';
import {resendTeacherAccessAction, unlinkTeacherAccessAction} from '@/features/teachers/teacher.actions';
import {getTeacher, getTeacherAccessStates} from '@/features/teachers/teacher.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function TeacherAccessPage({params, searchParams}: {
  params: Promise<{locale: string; id: string}>;
  searchParams: Promise<{access?: string}>;
}) {
  const {locale, id} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const teacher = await getTeacher(profile.schoolId, id);
  if (!teacher) notFound();

  const [{access}, accessStates, t, common] = await Promise.all([
    searchParams,
    getTeacherAccessStates([teacher]),
    getTranslations({locale, namespace: 'teachers'}),
    getTranslations({locale, namespace: 'common'})
  ]);
  const accessState = teacher.authUserId ? accessStates[teacher.id] ?? 'unknown' : null;

  return (
    <section className="admin-page">
      <PageHeader
        actions={<Link className="button button-secondary action-link" href={`/teachers/${teacher.id}`}>{t('backToTeacher')}</Link>}
        description={t('accessDescription')}
        title={`${teacher.displayName} — ${t('loginAccess')}`}
      />

      {access === 'sent' ? <Alert variant="success">{t('accessSent')}</Alert> : null}
      {access === 'failed' ? <Alert variant="danger">{t('accessFailed')}</Alert> : null}

      <Card>
        <SectionHeader title={t('loginAccess')} description={t('accessSeparationHelp')} />
        <p><strong>{t('loginEmail')}:</strong> {teacher.email ?? common('none')}</p>
        <p>
          <Badge variant={teacher.authUserId ? 'info' : 'warning'}>
            {teacher.authUserId ? t('accountLinked') : t('noAccountLinked')}
          </Badge>
        </p>
        <p>{accessState ? t(accessState) : t('accessUnlinkedHelp')}</p>

        <div className="form-actions">
          {teacher.email && teacher.isActive ? (
            <form action={resendTeacherAccessAction}>
              <input name="locale" type="hidden" value={locale} />
              <input name="id" type="hidden" value={teacher.id} />
              <Button type="submit" variant="secondary">
                {teacher.accountProfileId ? t('resendAccess') : t('enableLoginAccess')}
              </Button>
            </form>
          ) : null}
          {teacher.accountProfileId ? (
            <form action={unlinkTeacherAccessAction}>
              <input name="locale" type="hidden" value={locale} />
              <input name="teacherId" type="hidden" value={teacher.id} />
              <input name="profileId" type="hidden" value={teacher.accountProfileId} />
              <Button type="submit" variant="danger">{t('unlinkLoginAccess')}</Button>
            </form>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
