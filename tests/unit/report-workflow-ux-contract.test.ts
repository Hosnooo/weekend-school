import {
  existsSync,
  readFileSync
} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

function path(relative: string) {
  return join(process.cwd(), relative);
}

function read(relative: string) {
  return readFileSync(path(relative), 'utf8');
}

describe('Reports workflow UX contract', () => {
  it('presents Reports as a progressive editable workflow with finalization as the lock', () => {
    const page = read(
      'src/app/[locale]/(protected)/(admin)/reports/page.tsx'
    );

    expect(page).not.toContain('AdminPage');
    expect(page).toContain('PageHeader');
    expect(page).toContain('DataTable');
    expect(page).toContain('Alert');
    expect(page).toContain('ReportStudentReviewTable');

    expect(page).not.toContain('Tabs');
    expect(page).not.toContain('reviewReportBatchAction');
    expect(page).not.toContain("t('moveToReview')");

    expect(page).toContain("t('prepareStage')");
    expect(page).toContain("t('refreshSources')");
    expect(page).toContain("t('finalizeReports')");
    expect(page).toContain("t('sendStage')");
  });

  it('makes bulk sending discoverable only when sendable reports exist', () => {
    const page = read(
      'src/app/[locale]/(protected)/(admin)/reports/page.tsx'
    );

    expect(page).toContain('sendReadyReportsAction');
    expect(page).toContain('sendableReports');
    expect(page).toContain('sendableReports.length > 0');

    const en = JSON.parse(read('messages/en.json'));
    const ar = JSON.parse(read('messages/ar.json'));

    for (const messages of [en, ar]) {
      expect(messages.reports.sendResult).toContain('{sent}');
      expect(messages.reports.sendResult).toContain('{failed}');
      expect(messages.reports.sendResult).toContain('{skipped}');
    }
  });

  it('provides a first-class Delivery Status route with status filtering', () => {
    const relative =
      'src/app/[locale]/(protected)/(admin)/reports/delivery-status/page.tsx';

    expect(existsSync(path(relative))).toBe(true);

    if (!existsSync(path(relative))) return;

    const page = read(relative);

    expect(page).toContain('PageHeader');
    expect(page).toContain('DataTable');
    expect(page).toContain('searchParams');
    expect(page).toContain('PENDING');
    expect(page).toContain('SENT');
    expect(page).toContain('FAILED');
    expect(page).toContain('listDeliveryStatusRows');

    // Provider internals must not leak into the administrator UI.
    expect(page).not.toContain('provider_message_id');
  });

  it('makes Delivery Status directly reachable from Reports navigation', () => {
    const navigation = read('src/lib/auth/navigation.ts');
    const en = JSON.parse(read('messages/en.json'));
    const ar = JSON.parse(read('messages/ar.json'));

    expect(navigation).toContain("'deliveryStatus'");
    expect(navigation).toContain(
      "{href: '/reports/delivery-status', messageKey: 'deliveryStatus'}"
    );

    expect(en.navigation.deliveryStatus).toBe('Delivery status');
    expect(ar.navigation.deliveryStatus).toBe('حالة التسليم');
  });

  it('redesigns report preview without changing its read-only report snapshot', () => {
    const page = read(
      'src/app/[locale]/(protected)/(admin)/reports/[id]/page.tsx'
    );

    expect(page).not.toContain('AdminPage');
    expect(page).toContain('PageHeader');
    expect(page).toContain('Card');
    expect(page).toContain('DataTable');
    expect(page).toContain('renderStudentReport');
    expect(page).toContain('renderStudentReportV2');
    expect(page).toContain('/reports/delivery-status');
  });
});
