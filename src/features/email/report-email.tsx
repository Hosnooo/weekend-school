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
  language,
  placement
}: {
  snapshot: EmailReportSnapshot;
  language: CopyLanguage;
  placement: 'opening' | 'signoff';
}) {
  const suffix = language === 'ar' ? 'Ar' : 'En';
  const greeting = placement === 'opening'
    ? renderedValue(
        snapshot,
        `emailGreeting${suffix}` as EmailTemplateKey,
        language
      )
    : '';
  const message = placement === 'opening'
    ? renderedValue(
        snapshot,
        `emailMessage${suffix}` as EmailTemplateKey,
        language
      )
    : '';
  const closing = placement === 'signoff'
    ? renderedValue(
        snapshot,
        `emailClosing${suffix}` as EmailTemplateKey,
        language
      )
    : '';
  const signoff = placement === 'signoff'
    ? renderedValue(
        snapshot,
        `emailSignoff${suffix}` as EmailTemplateKey,
        language
      )
    : '';

  if (!greeting && !message && !closing && !signoff) return null;

  const paragraphStyle = {
    color: '#334155',
    fontSize: '15px',
    lineHeight: '1.7',
    overflowWrap: 'break-word',
    margin: '0 0 12px'
  } as const;

  return (
    <Section
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      style={{
        ...(placement === 'opening'
          ? {marginBottom: '20px'}
          : {marginTop: '20px'}),
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
      ? renderStudentReportV2(snapshot, snapshot.language, {
          includeSource: false,
          emailFriendly: true
        })
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
      <Head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>{`
          @media screen and (min-width: 600px) {
            .guardian-email-outer { padding: 22px !important; }
            .guardian-email-card { padding: 28px 32px !important; }
          }
        `}</style>
      </Head>
      <Preview>{preview}</Preview>

      <Body
        className="guardian-email-outer"
        style={{
          backgroundColor: '#f6f8fa',
          color: '#253645',
          fontFamily: 'Arial, Tahoma, sans-serif',
          fontSize: '15px',
          lineHeight: '1.7',
          margin: 0,
          padding: '10px'
        }}
      >
        <Container
          className="guardian-email-card"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5eaf0',
            borderRadius: '9px',
            boxSizing: 'border-box',
            margin: '0 auto',
            maxWidth: '640px',
            overflowWrap: 'break-word',
            padding: '18px 16px',
            width: '100%'
          }}
        >
          {contentDriven ||
          snapshot.language === 'en' ||
          snapshot.language === 'both' ? (
            <EmailCopy snapshot={snapshot} language="en" placement="opening" />
          ) : null}

          {contentDriven ||
          snapshot.language === 'ar' ||
          snapshot.language === 'both' ? (
            <EmailCopy snapshot={snapshot} language="ar" placement="opening" />
          ) : null}

          <Section>
            <div
              dangerouslySetInnerHTML={{
                __html: body
              }}
            />
          </Section>

          {contentDriven ||
          snapshot.language === 'en' ||
          snapshot.language === 'both' ? (
            <EmailCopy snapshot={snapshot} language="en" placement="signoff" />
          ) : null}

          {contentDriven ||
          snapshot.language === 'ar' ||
          snapshot.language === 'both' ? (
            <EmailCopy snapshot={snapshot} language="ar" placement="signoff" />
          ) : null}
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
