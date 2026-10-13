type DeliveryResult = {sent?:string;failed?:string;missing?:string;already?:string;pending?:string;error?:string};
const labels = {
  en: {
    title:'Guardian email delivery result', accepted:'Accepted by Brevo', failed:'Failed',
    missing:'No recipient', already:'Already sent (not repeated)', pending:'Pending review',
    noRecipients:'No eligible guardian emails are ready for sending.',
    confirmRecipients:'Review missing guardian recipients before sending.',
    send:'Delivery could not be completed. Review delivery history before trying again.'
  },
  ar: {
    title:'نتائج إرسال تقارير أولياء الأمور',accepted:'قَبِل مزود البريد Brevo',
    failed:'فشل',missing:'بلا مستلم',already:'أُرسل سابقًا دون تكرار',pending:'قيد المراجعة',
    noRecipients:'لا توجد رسائل مؤهلة جاهزة للإرسال حاليًا.',
    confirmRecipients:'راجع أولياء الأمور غير المتوفرين قبل الإرسال.',
    send:'تعذر إكمال الإرسال. راجع سجل الإرسال قبل المحاولة مجددًا.'
  }
};
export function GuardianDeliveryOutcome({locale,result}:{
  locale:'en'|'ar';result:DeliveryResult
}) {
  const t=labels[locale];
  if (result.error && ['noRecipients','confirmRecipients','send'].includes(result.error)) {
    return <p role="alert" className="form-error">{t[result.error as 'noRecipients'|'confirmRecipients'|'send']}</p>;
  }
  if (result.sent === undefined) return null;
  return (
    <section className="detail-section stack" role="status">
      <strong>{t.title}</strong>
      <div className="guardian-delivery-numbers">
        <span>{t.accepted}: <strong>{Number(result.sent)||0}</strong></span>
        <span>{t.failed}: <strong>{Number(result.failed)||0}</strong></span>
        <span>{t.missing}: <strong>{Number(result.missing)||0}</strong></span>
        <span>{t.already}: <strong>{Number(result.already)||0}</strong></span>
        <span>{t.pending}: <strong>{Number(result.pending)||0}</strong></span>
      </div>
    </section>
  );
}
