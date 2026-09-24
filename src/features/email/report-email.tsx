import {Body} from '@react-email/body';
import {Container} from '@react-email/container';
import {Head} from '@react-email/head';
import {Html} from '@react-email/html';
import {Preview} from '@react-email/preview';
import {Section} from '@react-email/section';
import {renderToStaticMarkup} from 'react-dom/server.browser';
import type {ReportSnapshot, ReportSnapshotV2} from '@/features/reports/report.types';
import {renderStudentReport, renderStudentReportV2} from '@/features/reports/report.renderer';

type EmailReportSnapshot = ReportSnapshot | ReportSnapshotV2;

function ReportEmail({snapshot}: {snapshot: EmailReportSnapshot}) {
  const document = snapshot.version === 2
    ? renderStudentReportV2(snapshot, snapshot.language)
    : renderStudentReport(snapshot, snapshot.language);
  const body = document.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? document;
  const preview = snapshot.language === 'ar'
    ? 'تقرير الطالب'
    : snapshot.language === 'both'
      ? 'Student Report / تقرير الطالب'
      : 'Student Report';
  return <Html dir={snapshot.language === 'ar' ? 'rtl' : 'ltr'} lang={snapshot.language === 'ar' ? 'ar' : 'en'}>
    <Head/>
    <Preview>{preview}</Preview>
    <Body style={{backgroundColor: '#f7f8fa', fontFamily: 'Arial, sans-serif', margin: 0, padding: '24px'}}>
      <Container style={{backgroundColor: '#ffffff', margin: '0 auto', maxWidth: '768px', padding: '24px'}}>
        <Section><div dangerouslySetInnerHTML={{__html: body}}/></Section>
      </Container>
    </Body>
  </Html>;
}

export function renderReportEmail(snapshot: EmailReportSnapshot) {
  return `<!doctype html>${renderToStaticMarkup(<ReportEmail snapshot={snapshot}/>)}`;
}
