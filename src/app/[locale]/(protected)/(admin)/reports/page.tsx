import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {AdminPage} from '@/components/ui/admin-page';
import {sendReadyReportsAction,sendReportAction} from '@/features/email/email.actions';
import {generateReportsAction} from '@/features/reports/report.actions';
import {buildReportReadiness,getReportingTimezone,listReports} from '@/features/reports/report.repository';
import {monthPeriod} from '@/features/reports/report.service';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth/require-profile';

export default async function ReportsPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{periodStart?:string;periodEnd?:string;error?:string;generated?:string;sent?:string;failed?:string;skipped?:string}>}){
  const{locale}=await params;if(!isLocale(locale))notFound();
  const profile=await requireProfile(locale,'ADMIN');const query=await searchParams;
  const timezone=await getReportingTimezone(profile.schoolId);const defaults=monthPeriod(todayInTimeZone(timezone));
  const periodStart=/^\d{4}-\d{2}-\d{2}$/.test(query.periodStart??'')?query.periodStart!:defaults.periodStart;
  const periodEnd=/^\d{4}-\d{2}-\d{2}$/.test(query.periodEnd??'')?query.periodEnd!:defaults.periodEnd;
  const[readiness,reports]=await Promise.all([buildReportReadiness(profile.schoolId,periodStart,periodEnd),listReports(profile.schoolId,periodStart,periodEnd)]);
  const t=await getTranslations({locale,namespace:'reports'});const languages=await getTranslations({locale,namespace:'reportLanguages'});
  const hidden=<><input name="locale" type="hidden" value={locale}/><input name="periodStart" type="hidden" value={periodStart}/><input name="periodEnd" type="hidden" value={periodEnd}/></>;
  return <AdminPage title={t('title')} description={t('description')}>
    <form className="period-form" method="get"><label>{t('periodStart')}<input defaultValue={periodStart} name="periodStart" required type="date"/></label><label>{t('periodEnd')}<input defaultValue={periodEnd} name="periodEnd" required type="date"/></label><button className="button button-secondary">{t('title')}</button></form>
    <div className="report-summary"><div><strong>{readiness.studentCount}</strong><span>{t('students')}</span></div><div><strong>{readiness.ready}</strong><span>{t('ready')}</span></div><div><strong>{readiness.missingData}</strong><span>{t('missingData')}</span></div><div><strong>{readiness.missingGuardianEmail}</strong><span>{t('missingEmail')}</span></div></div>
    {query.error?<p className="form-error" role="alert">{t(query.error==='validation'?'validation':query.error==='send'?'sendError':'save')}</p>:null}
    {query.generated!==undefined?<p className="success-message">{t('generated',{count:Number(query.generated)||0})}</p>:null}
    {query.sent!==undefined?<p className="success-message">{t('sendResult',{sent:Number(query.sent)||0,failed:Number(query.failed)||0,skipped:Number(query.skipped)||0})}</p>:null}
    <div className="page-actions"><form action={generateReportsAction}>{hidden}<button className="button button-primary">{t('generate')}</button></form><form action={sendReadyReportsAction}>{hidden}<button className="button button-secondary">{t('sendReady')}</button></form></div>
    {reports.length===0?<p className="empty-state">{t('empty')}</p>:<div className="table-wrap"><table><thead><tr><th>{t('student')}</th><th>{t('language')}</th><th>{t('status')}</th><th>{t('generatedAt')}</th><th></th></tr></thead><tbody>{reports.map((report)=>{const isPending=report.deliveryStatuses.includes('PENDING');const displayStatus=isPending?'PENDING':report.status;return <tr key={report.id}><td>{locale==='ar'&&report.studentNameAr?report.studentNameAr:report.studentNameEn}</td><td>{languages(report.language)}</td><td><span className={`status-badge ${displayStatus==='FAILED'?'status-inactive':'status-active'}`}>{t(`reportStatus.${displayStatus}`)}</span></td><td>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(report.generatedAt))}</td><td><div className="row-actions"><Link href={`/reports/${report.id}`}>{t('preview')}</Link>{!isPending&&(report.status==='READY'||report.status==='FAILED')?<form action={sendReportAction}>{hidden}<input name="reportId" type="hidden" value={report.id}/><button className="text-button">{report.status==='FAILED'?t('retry'):t('send')}</button></form>:null}</div></td></tr>;})}</tbody></table></div>}
  </AdminPage>;
}
