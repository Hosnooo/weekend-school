import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Card} from '@/components/ui/card';
import {PageHeader} from '@/components/ui/page-header';
import {SectionHeader} from '@/components/ui/section-header';
import {StatusBadge} from '@/components/ui/status-badge';
import {getGuardianDetail} from '@/features/guardians/guardian.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function GuardianDetailPage({params}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const [guardian, t, common, studentsT, teachersT, reportLanguages] = await Promise.all([
    getGuardianDetail(profile.schoolId, id),
    getTranslations({locale, namespace: 'guardians'}),
    getTranslations({locale, namespace: 'common'}),
    getTranslations({locale, namespace: 'students'}),
    getTranslations({locale, namespace: 'teachers'}),
    getTranslations({locale, namespace: 'reportLanguages'})
  ]);
  if (!guardian) notFound();

  const studentName = (student: (typeof guardian.students)[number]) =>
    locale === 'ar' && student.firstNameAr && student.lastNameAr
      ? `${student.firstNameAr} ${student.lastNameAr}`
      : `${student.firstNameEn} ${student.lastNameEn}`;

  return (
    <section className="admin-page">
      <PageHeader
        actions={<Link className="button button-secondary action-link" href={`/guardians/${guardian.id}/edit`}>{common('edit')}</Link>}
        breadcrumbs={[
          {label: t('title'), href: `/${locale}/guardians`},
          {label: guardian.name}
        ]}
        description={t('description')}
        title={guardian.name}
      />

      <div className="form-grid">
        <Card>
          <SectionHeader title={teachersT('identityContact')} />
          <p><strong>{t('name')}:</strong> {guardian.name}</p>
          <p><strong>{t('email')}:</strong> <a href={`mailto:${guardian.email}`}>{guardian.email}</a></p>
          <p><strong>{t('reportLanguage')}:</strong> {reportLanguages(guardian.reportLanguage)}</p>
        </Card>

        <Card>
          <SectionHeader title={studentsT('title')} />
          {guardian.students.length === 0 ? <p>{studentsT('empty')}</p> : (
            <div className="stack-list">
              {guardian.students.map((student) => (
                <div key={student.id}>
                  <Link href={`/students/${student.id}`}><strong>{studentName(student)}</strong></Link>
                  <div>
                    {student.isPrimary ? studentsT('guardianSection') : t('title')}
                    {student.receivesReports ? ` · ${t('reportLanguage')}` : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader title={teachersT('lifecycle')} />
          <StatusBadge status={guardian.isActive ? 'active' : 'inactive'}>
            {guardian.isActive ? common('active') : common('inactive')}
          </StatusBadge>
        </Card>
      </div>
    </section>
  );
}
