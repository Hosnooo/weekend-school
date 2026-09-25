import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {PageHeader} from '@/components/ui/page-header';
import {StudentForm} from '@/features/students/student-form';
import {getStudent} from '@/features/students/student.repository';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function EditStudentPage({params}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const [student, t] = await Promise.all([
    getStudent(profile.schoolId, id),
    getTranslations({locale, namespace: 'students'})
  ]);
  if (!student) notFound();

  const studentName = locale === 'ar' && student.firstNameAr && student.lastNameAr
    ? `${student.firstNameAr} ${student.lastNameAr}`
    : `${student.firstNameEn} ${student.lastNameEn}`;

  return (
    <section className="admin-page">
      <PageHeader
        breadcrumbs={[
          {label: t('title'), href: `/${locale}/students`},
          {label: studentName, href: `/${locale}/students/${student.id}`},
          {label: t('editTitle')}
        ]}
        description={t('description')}
        title={t('editTitle')}
      />
      <StudentForm cancelHref={`/students/${student.id}`} locale={locale} student={student} />
    </section>
  );
}
