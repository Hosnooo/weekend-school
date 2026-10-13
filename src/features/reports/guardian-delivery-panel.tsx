import {ConfirmSubmitButton} from '@/components/ui/confirm-submit-button';
import {sendAdminReportBatchAction} from '@/features/reports/admin-report-delivery.actions';
import {getRecipientReadiness} from '@/features/reports/recipient-delivery.repository';
import {Link} from '@/i18n/navigation';

const words = {
  en: {
    title: 'Guardian email delivery', eligible: 'Eligible reports', ready: 'Emails ready',
    missing: 'Missing recipients', already: 'Already sent', pending: 'Pending review',
    help: 'These reports will be skipped. The other families can still receive theirs.',
    blocked: 'No email is ready to send. Resolve the recipient or pending-delivery issues first.',
    reason: 'No eligible guardian', manage: 'Manage students',
    send: 'Send available reports',
    confirm: (ready: number, missing: number) =>
      'Send up to ' + ready + ' eligible guardian email(s)? ' +
      missing + ' report(s) have no recipient and will be skipped. Previously sent emails will not be repeated.'
  },
  ar: {
    title: 'إرسال تقارير أولياء الأمور', eligible: 'تقارير مؤهلة', ready: 'رسائل جاهزة',
    missing: 'مستلمون غير متوفرين', already: 'أُرسل سابقًا', pending: 'قيد المراجعة',
    help: 'لن تُرسل هذه التقارير الآن، ويمكن إرسال تقارير الأسر الأخرى.',
    blocked: 'لا توجد رسائل جاهزة للإرسال. عالج مشكلات المستلمين أو الرسائل المعلقة أولًا.',
    reason: 'لا يوجد ولي أمر مؤهل', manage: 'إدارة الطلاب',
    send: 'إرسال التقارير المتاحة',
    confirm: (ready: number, missing: number) =>
      'هل تريد إرسال ' + ready + ' رسالة مؤهلة بحد أقصى؟ هناك ' +
      missing + ' تقريرًا دون مستلم ولن تُعاد الرسائل المرسلة سابقًا.'
  }
};

export async function GuardianDeliveryPanel({
  schoolId, batchId, periodStart, periodEnd, locale, returnTo = 'workspace'
}: {
  schoolId: string; batchId: string; periodStart: string; periodEnd: string;
  locale: 'en' | 'ar'; returnTo?: 'queue' | 'workspace';
}) {
  const summary = await getRecipientReadiness(schoolId, {batchId});
  if (summary.reportCount === 0) return null;
  const t = words[locale];
  return (
    <section className="detail-section stack guardian-delivery-panel" aria-label={t.title}>
      <h3>{t.title}</h3>
      <div className="guardian-delivery-numbers">
        <span>{t.eligible}: <strong>{summary.eligibleReports}</strong></span>
        <span>{t.ready}: <strong>{summary.readyEmails}</strong></span>
        <span>{t.missing}: <strong>{summary.missing.length}</strong></span>
        <span>{t.already}: <strong>{summary.alreadySent}</strong></span>
        <span>{t.pending}: <strong>{summary.pendingReview}</strong></span>
      </div>
      {summary.missing.length ? (
        <div className="form-warning" role="status">
          <p><strong>{t.missing}: {summary.missing.length}.</strong> {t.help}</p>
          <ul>{summary.missing.map(item => (
            <li key={item.reportId}>
              {locale === 'ar' && item.studentNameAr ? item.studentNameAr : item.studentNameEn}
              {' — '}{t.reason}
            </li>
          ))}</ul>
          <Link href="/students">{t.manage}</Link>
        </div>
      ) : null}
      {summary.readyEmails === 0 ? <p className="field-help">{t.blocked}</p> : null}
      <form action={sendAdminReportBatchAction}>
        <input type="hidden" name="locale" value={locale}/>
        <input type="hidden" name="batchId" value={batchId}/>
        <input type="hidden" name="periodStart" value={periodStart}/>
        <input type="hidden" name="periodEnd" value={periodEnd}/>
        <input type="hidden" name="returnTo" value={returnTo}/>
        <input type="hidden" name="ackMissing" value="yes"/>
        <ConfirmSubmitButton type="submit" className="button button-primary"
          disabled={summary.readyEmails === 0}
          confirmMessage={t.confirm(summary.readyEmails, summary.missing.length)}>
          {t.send}
        </ConfirmSubmitButton>
      </form>
    </section>
  );
}
