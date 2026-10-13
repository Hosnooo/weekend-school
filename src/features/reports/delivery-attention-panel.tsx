import {ConfirmSubmitButton} from '@/components/ui/confirm-submit-button';
import {sendAdminSingleReportAction} from './admin-report-delivery.actions';
import {getRecipientReadiness} from './recipient-delivery.repository';
import {Link} from '@/i18n/navigation';

const localeText = {
  en:{
    title:'Needs delivery attention', explanation:'Reports remain here until missing guardians or unsuccessful deliveries are resolved.',
    missing:'No eligible guardian recipient',pending:'Pending delivery requires reconciliation',
    failed:'Delivery failed',notSent:'Not yet sent',resolve:'Manage students',
    open:'Open report cycle',send:'Send only this student’s report',
    confirm:'Send this student report to eligible guardians? Previously accepted emails will not be resent.'
  },
  ar:{
    title:'تقارير تحتاج إلى متابعة الإرسال',explanation:'تبقى التقارير هنا حتى يتم حل مشكلة المستلمين أو الإرسال.',
    missing:'لا يوجد ولي أمر مؤهل',pending:'رسالة معلقة تحتاج إلى مراجعة',
    failed:'فشل الإرسال',notSent:'لم يُرسل بعد',resolve:'إدارة الطلاب',
    open:'فتح دورة التقارير',send:'إرسال تقرير هذا الطالب فقط',
    confirm:'هل تريد إرسال تقرير هذا الطالب إلى أولياء الأمور المؤهلين؟ لن تُكرر الرسائل المرسلة سابقًا.'
  }
};
export async function DeliveryAttentionPanel({schoolId,locale}:{schoolId:string;locale:'en'|'ar'}) {
  const readiness=await getRecipientReadiness(schoolId);
  const t=localeText[locale];
  return (
    <section className="detail-section stack" aria-label={t.title}>
      <h2>{t.title} ({readiness.attention.length})</h2>
      <p className="field-help">{t.explanation}</p>
      {readiness.attention.length > 0 ? (
        <ul className="guardian-delivery-attention">
          {readiness.attention.map(item=>(
            <li key={item.reportId} className="stack">
              <strong>{locale==='ar'&&item.studentNameAr?item.studentNameAr:item.studentNameEn}</strong>
              <span dir="ltr">{item.periodStart} – {item.periodEnd}</span>
              <span>{item.reason==='NO_RECIPIENT'?t.missing:item.reason==='PENDING'?t.pending:item.reason==='FAILED'?t.failed:t.notSent}</span>
              <div className="row-actions">
                <Link href={'/reports/workspace/'+item.batchId}>{t.open}</Link>
                {item.reason==='NO_RECIPIENT'?<Link href="/students">{t.resolve}</Link>
                 :item.reason==='PENDING'?null:(
                  <form action={sendAdminSingleReportAction}>
                    <input name="locale" type="hidden" value={locale}/>
                    <input name="reportId" type="hidden" value={item.reportId}/>
                    <ConfirmSubmitButton type="submit" className="button button-secondary"
                      confirmMessage={t.confirm}>{t.send}</ConfirmSubmitButton>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
