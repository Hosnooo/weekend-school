import {Body} from '@react-email/body';
import {Container} from '@react-email/container';
import {Head} from '@react-email/head';
import {Html} from '@react-email/html';
import {Preview} from '@react-email/preview';
import {Section} from '@react-email/section';
import {renderToStaticMarkup} from 'react-dom/server.browser';

import type {
  ReportSnapshot,
  ReportSnapshotV2
} from '@/features/reports/report.types';
import {
  renderStudentReport,
  renderStudentReportV2
} from '@/features/reports/report.renderer';

type EmailReportSnapshot = ReportSnapshot | ReportSnapshotV2;
type CopyLanguage = 'en' | 'ar';

const defaults = {
  emailSubjectEn:
    'Student report — {{student_name}}',
  emailSubjectAr:
    'تقرير الطالب — {{student_name}}',
  emailGreetingEn: 'Dear Parent/Guardian,',
  emailGreetingAr: 'ولي الأمر الكريم،',
  emailMessageEn:
    "Please find below {{student_name}}'s report for {{period_start}} to {{period_end}}.",
  emailMessageAr:
    'يرجى الاطلاع أدناه على تقرير {{student_name}} للفترة من {{period_start}} إلى {{period_end}}.',
  emailClosingEn: 'Regards,',
  emailClosingAr: 'مع التحية،',
  emailSignoffEn: '{{school_name}}',
  emailSignoffAr: '{{school_name}}'
} as const;

type EmailTemplateKey = keyof typeof defaults;

function configuredValue(
  snapshot: EmailReportSnapshot,
  key: EmailTemplateKey
) {
  if (snapshot.version !== 2) return defaults[key];

  if (!(key in snapshot.template)) return defaults[key];

  return snapshot.template[key] ?? '';
}

function valuesFor(
  snapshot: EmailReportSnapshot,
  language: CopyLanguage
) {
  return {
    student_name:
      language === 'ar'
        ? snapshot.student.nameAr ?? snapshot.student.nameEn
        : snapshot.student.nameEn,
    school_name:
      language === 'ar'
        ? snapshot.school.nameAr ?? snapshot.school.nameEn
        : snapshot.school.nameEn,
    period_start: snapshot.period.start,
    period_end: snapshot.period.end
  };
}

function applyPlaceholders(
  value: string,
  snapshot: EmailReportSnapshot,
  language: CopyLanguage
) {
  const values = valuesFor(snapshot, language);

  return value.replace(
    /\{\{(student_name|school_name|period_start|period_end)\}\}/g,
    (_match, key: keyof typeof values) => values[key]
  );
}

function renderedValue(
  snapshot: EmailReportSnapshot,
  key: EmailTemplateKey,
  language: CopyLanguage
) {
  return applyPlaceholders(
    configuredValue(snapshot, key),
    snapshot,
    language
  );
}

function subjectFor(
  snapshot: EmailReportSnapshot,
  language: CopyLanguage
) {
  const key =
    language === 'ar' ? 'emailSubjectAr' : 'emailSubjectEn';

  let configured = configuredValue(snapshot, key);

  if (
    !configured.trim() &&
    language === 'ar' &&
    (snapshot.version === 1 || snapshot.language !== 'both')
  ) {
    configured = configuredValue(snapshot, 'emailSubjectEn');
  }

  return applyPlaceholders(configured, snapshot, language);
}

export function renderReportEmailSubject(
  snapshot: EmailReportSnapshot
) {
  if (snapshot.language === 'en') {
    return subjectFor(snapshot, 'en');
  }

  if (snapshot.language === 'ar') {
    return subjectFor(snapshot, 'ar');
  }

  const english = subjectFor(snapshot, 'en');
  const arabic = subjectFor(snapshot, 'ar');

  return [...new Set([english, arabic].filter(Boolean))].join(' / ');
}

function EmailCopy({
  snapshot,
  language
}: {
  snapshot: EmailReportSnapshot;
  language: CopyLanguage;
}) {
  const suffix = language === 'ar' ? 'Ar' : 'En';
  const greeting = renderedValue(
    snapshot,
    `emailGreeting${suffix}` as EmailTemplateKey,
    language
  );
  const message = renderedValue(
    snapshot,
    `emailMessage${suffix}` as EmailTemplateKey,
    language
  );
  const closing = renderedValue(
    snapshot,
    `emailClosing${suffix}` as EmailTemplateKey,
    language
  );
  const signoff = renderedValue(
    snapshot,
    `emailSignoff${suffix}` as EmailTemplateKey,
    language
  );

  if (!greeting && !message && !closing && !signoff) return null;

  const paragraphStyle = {
    fontSize: '15px',
    lineHeight: '1.65',
    margin: '0 0 12px'
  } as const;

  return (
    <Section
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      style={{
        borderBottom: '1px solid #e5e7eb',
        marginBottom: '24px',
        paddingBottom: '20px',
        textAlign: language === 'ar' ? 'right' : 'left'
      }}
    >
      {greeting ? (
        <p style={{...paragraphStyle, fontWeight: 600}}>
          {greeting}
        </p>
      ) : null}

      {message ? (
        <p style={{...paragraphStyle, whiteSpace: 'pre-line'}}>
          {message}
        </p>
      ) : null}

      {closing ? (
        <p style={{...paragraphStyle, marginTop: '20px'}}>
          {closing}
        </p>
      ) : null}

      {signoff ? (
        <p style={{...paragraphStyle, marginBottom: 0}}>
          {signoff}
        </p>
      ) : null}
    </Section>
  );
}

function ReportEmail({
  snapshot
}: {
  snapshot: EmailReportSnapshot;
}) {
  const document =
    snapshot.version === 2
      ? renderStudentReportV2(snapshot, snapshot.language)
      : renderStudentReport(snapshot, snapshot.language);

  const body =
    document.match(/<body>([\s\S]*)<\/body>/)?.[1] ??
    document;

  const preview = renderReportEmailSubject(snapshot);
  const contentDriven =
    snapshot.version === 2 && snapshot.language === 'both';

  return (
    <Html
      dir={snapshot.language === 'ar' ? 'rtl' : 'ltr'}
      lang={snapshot.language === 'ar' ? 'ar' : 'en'}
    >
      <Head />
      <Preview>{preview}</Preview>

      <Body
        style={{
          backgroundColor: '#f7f8fa',
          fontFamily: 'Arial, sans-serif',
          margin: 0,
          padding: '24px'
        }}
      >
        <Container
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '10px',
            margin: '0 auto',
            maxWidth: '720px',
            padding: '32px'
          }}
        >
          {contentDriven ||
          snapshot.language === 'en' ||
          snapshot.language === 'both' ? (
            <EmailCopy snapshot={snapshot} language="en" />
          ) : null}

          {contentDriven ||
          snapshot.language === 'ar' ||
          snapshot.language === 'both' ? (
            <EmailCopy snapshot={snapshot} language="ar" />
          ) : null}

          <Section>
            <div
              dangerouslySetInnerHTML={{
                __html: body
              }}
            />
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function renderReportEmail(
  snapshot: EmailReportSnapshot
) {
  return `<!doctype html>${renderToStaticMarkup(
    <ReportEmail snapshot={snapshot} />
  )}`;
}
