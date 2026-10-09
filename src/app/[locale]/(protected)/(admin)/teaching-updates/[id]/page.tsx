import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Badge} from '@/components/ui/badge';
import {openClassReportEditorAction} from '@/features/reports/class-report-review.actions';
import {canReopenClassReportCycle} from '@/features/reports/class-report-preview.repository';
import {PageHeader} from '@/components/ui/page-header';
import {listAdminTeachingUpdates} from '@/features/teaching-updates/admin-teaching-update.repository';
import {formatTeachingUpdateRange} from '@/features/teaching-updates/teaching-update-date';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth/require-profile';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {databaseUuid} from '@/lib/validation/fields';

/**
 * Administrator-only read view of a submitted Teaching Update.
 *
 * The original Teacher submission is source/audit history. Where the source
 * participates in one or more Report Cycles, show the stored cycle-specific
 * approval and provide a direct link to its report editor/preview. Never
 * mistake the raw submitted Teacher text for the approved report version.
 */
export default async function AdminSubmittedTeachingUpdatePage({
  params
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id: rawId} = await params;
  if (!isLocale(locale)) notFound();
  const id = databaseUuid.safeParse(rawId);
  if (!id.success) notFound();

  const profile = await requireProfile(locale, 'ADMIN');
  const [updates, t] = await Promise.all([
    listAdminTeachingUpdates(profile.schoolId),
    getTranslations({locale, namespace: 'adminTeachingUpdates'})
  ]);
  const submission = updates.find(({id: updateId}) => updateId === id.data);
  if (!submission || submission.status !== 'SUBMITTED') notFound();

  const db = await createServerSupabaseClient();
  const {data: sourceLinks, error: linkError} = await db
    .from('report_section_sources')
    .select('approval_id,included')
    .eq('school_id', profile.schoolId)
    .eq('weekly_submission_id', id.data);
  if (linkError) throw linkError;

  const approvalIds = [...new Set((sourceLinks ?? []).map(({approval_id}) => approval_id))];
  const {data: approvalRows, error: approvalError} = approvalIds.length
    ? await db
        .from('report_section_approvals')
        .select('id,batch_id,class_subject_id,subject_group_id,approved_progress_en,approved_progress_ar')
        .eq('school_id', profile.schoolId)
        .in('id', approvalIds)
    : {data: [], error: null};
  if (approvalError) throw approvalError;

  // Match BOTH subject and group, never subject alone.
  const approvals = (approvalRows ?? []).filter((approval) =>
    approval.class_subject_id === submission.classSubjectId &&
    approval.subject_group_id === submission.subjectGroupId
  );
  const batchIds = [...new Set(approvals.map(({batch_id}) => batch_id))];
  const approvedIds = approvals.map(({id}) => id);

  const [{data: cycles, error: cycleError}, {data: overrides, error: overrideError}] =
    await Promise.all([
      batchIds.length
        ? db.from('report_batches')
            .select('id,status,period_start,period_end')
            .eq('school_id', profile.schoolId)
            .in('id', batchIds)
        : Promise.resolve({data: [], error: null}),
      approvedIds.length
        ? db.from('report_student_overrides')
            .select('approval_id,student_id,attendance_attended,attendance_total,comment_en,comment_ar')
            .eq('school_id', profile.schoolId)
            .in('approval_id', approvedIds)
        : Promise.resolve({data: [], error: null})
    ]);
  if (cycleError) throw cycleError;
  if (overrideError) throw overrideError;

  const studentIds = [...new Set((overrides ?? []).map(({student_id}) => student_id))];
  const {data: reportRows, error: reportsError} = batchIds.length
    ? await db.from('reports')
        .select('id,batch_id,student_id,language,revision,status')
        .eq('school_id', profile.schoolId)
        .in('batch_id', batchIds)
        .order('revision', {ascending: false})
    : {data: [], error: null};
  if (reportsError) throw reportsError;

  const editableFinalized = new Set<string>(
    (await Promise.all((cycles ?? [])
      .filter(({status}) => status === 'FINALIZED')
      .map(async ({id}) => (await canReopenClassReportCycle(profile.schoolId, id))
        ? id : null)
    )).filter((id): id is string => id !== null)
  );

  const {data: students, error: studentError} = studentIds.length
    ? await db.from('students')
        .select('id,first_name_en,last_name_en,first_name_ar,last_name_ar')
        .eq('school_id', profile.schoolId)
        .in('id', studentIds)
    : {data: [], error: null};
  if (studentError) throw studentError;

  const names = new Map((students ?? []).map((student) => [
    student.id,
    locale === 'ar' && student.first_name_ar && student.last_name_ar
      ? `${student.first_name_ar} ${student.last_name_ar}`
      : `${student.first_name_en} ${student.last_name_en}`
  ]));

  return (
    <section className="admin-page">
      <PageHeader
        actions={<Link className="button button-secondary action-link" href="/teaching-updates">{t('backToUpdates')}</Link>}
        title={t('submittedViewTitle')}
        description={`${submission.classNameEn} · ${submission.subjectNameEn} · ${formatTeachingUpdateRange(submission.periodStart, submission.periodEnd, locale)}`}
      />

      {approvals.length > 0 ? (
        <section className="detail-section stack">
          <h2>{t('cycleApprovedVersions')}</h2>
          <p className="record-meta">{t('approvedVersionHelp')}</p>
          {approvals.map((approval) => {
            const cycle = (cycles ?? []).find(({id: batchId}) => batchId === approval.batch_id);
            if (!cycle) return null;
            const included = (sourceLinks ?? []).some((link) =>
              link.approval_id === approval.id && link.included
            );
            const rows = (overrides ?? []).filter(({approval_id}) => approval_id === approval.id);
            return (
              <article className="record-card stack" key={approval.id}>
                <div className="row-actions">
                  <strong>{formatTeachingUpdateRange(cycle.period_start, cycle.period_end, locale)}</strong>
                  <Badge variant={included ? 'success' : 'neutral'}>
                    {included ? t('includedInCycle') : t('excludedFromCycle')}
                  </Badge>
                </div>

                <div className="form-grid">
                  <div>
                    <strong>{t('approvedEnglish')}</strong>
                    <p style={{whiteSpace: 'pre-wrap'}}>{approval.approved_progress_en ?? '—'}</p>
                  </div>
                  <div>
                    <strong>{t('approvedArabic')}</strong>
                    <p dir="rtl" style={{whiteSpace: 'pre-wrap'}}>{approval.approved_progress_ar ?? '—'}</p>
                  </div>
                </div>

                {rows.length > 0 ? (
                  <div className="stack">
                    <strong>{t('savedStudentCorrections')}</strong>
                    {rows.map((row) => (
                      <div className="record-meta" key={row.student_id}>
                        <strong>{names.get(row.student_id) ?? t('student')}</strong>
                        {' · '}
                        {row.attendance_attended !== null && row.attendance_total !== null
                          ? `${row.attendance_attended} / ${row.attendance_total}`
                          : t('attendanceFromSource')}
                        {row.comment_en ? ` · ${row.comment_en}` : ''}
                        {row.comment_ar ? ` · ${row.comment_ar}` : ''}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="row-actions">
                  {(() => {
                    const direct = (reportRows ?? []).find((report) =>
                      report.batch_id === cycle.id
                    );
                    return direct ? (
                      <Link className="button button-secondary action-link"
                        href={`/reports/${direct.id}`}>
                        {t('viewDirectReport')}
                      </Link>
                    ) : null;
                  })()}
                  <Link className="button button-secondary action-link"
                    href={`/reports/workspace/${cycle.id}`}>
                    {t('viewCycleReport')}
                  </Link>
                  {included && (cycle.status !== 'FINALIZED' ||
                    editableFinalized.has(cycle.id)) ? (
                    <form action={openClassReportEditorAction}>
                      <input type="hidden" name="locale" value={locale}/>
                      <input type="hidden" name="batchId" value={cycle.id}/>
                      <input type="hidden" name="classSubjectId" value={approval.class_subject_id}/>
                      <input type="hidden" name="subjectGroupId" value={approval.subject_group_id ?? ''}/>
                      <button type="submit" className="button button-secondary">
                        {t('editCycleReport')}
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="detail-section">
          <p>{t('noCycleApproval')}</p>
        </section>
      )}

      <details className="secondary-disclosure">
        <summary>{t('teacherSourceAudit')}</summary>
        <section className="detail-section stack">
          <p className="record-meta">{t('teacherSourceHelp')}</p>
          <strong>{t('approvedEnglish')}</strong>
          <p style={{whiteSpace: 'pre-wrap'}}>{submission.progressEn ?? '—'}</p>
          <strong>{t('approvedArabic')}</strong>
          <p dir="rtl" style={{whiteSpace: 'pre-wrap'}}>{submission.progressAr ?? '—'}</p>
        </section>
      </details>
    </section>
  );
}
