import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {StatusBadge} from '@/components/ui/status-badge';
import {AccountWorkspace} from '@/features/profiles/account-workspace';
import {listTeachers} from '@/features/teachers/teacher.repository';
import {isLocale} from '@/i18n/config';
import {requireProfileWithCapabilities} from '@/lib/auth/require-profile';
import {createServerSupabaseClient} from '@/lib/supabase/server';

export default async function AccountPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const {profile, capabilities} = await requireProfileWithCapabilities(locale);
  const db = await createServerSupabaseClient();
  const [authResult, translations, teacherRecords] = await Promise.all([
    db.auth.getUser(),
    getTranslations({locale, namespace: 'account'}),
    capabilities.teacherIds.length ? listTeachers(profile.schoolId) : Promise.resolve([])
  ]);
  const teachers = teacherRecords.filter((teacher) => capabilities.teacherIds.includes(teacher.id));

  return (
    <section className="admin-page">
      <PageHeader title={translations('title')} description={translations('description')} />
      <div className="settings-page-sections">
        <AccountWorkspace displayName={profile.displayName} email={authResult.data.user?.email ?? ''} />
        {capabilities.teacherIds.length ? (
          <section className="detail-section">
            <h2>{translations('teacherRecords')}</h2>
            {teachers.length === 0 ? <EmptyState title={translations('noTeacherRecords')} /> :
              <div className="teacher-profile-list">
                {teachers.map((teacher) => (
                  <div className="teacher-profile-row" key={teacher.id}>
                    <div className="section-heading">
                      <div>
                        <h3 className="record-name">{teacher.displayName}</h3>
                        <p className="record-meta">{teacher.email ?? ''}</p>
                      </div>
                      <StatusBadge status={teacher.isActive ? 'active' : 'inactive'}>
                        {translations(teacher.isActive ? 'active' : 'inactive')}
                      </StatusBadge>
                    </div>
                  </div>
                ))}
              </div>
            }
          </section>
        ) : null}
      </div>
    </section>
  );
}
