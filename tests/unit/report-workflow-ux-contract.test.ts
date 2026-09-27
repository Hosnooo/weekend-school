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
  it('presents one status-driven reporting workflow by teaching context', () => {
    const page = read(
      'src/app/[locale]/(protected)/(admin)/reports/page.tsx'
    );

    expect(page).toContain('PageHeader');
    expect(page).toContain('Card');
    expect(page).toContain('Alert');

    expect(page).toContain('listAdminReportContexts');
    expect(page).toContain('getAdminReportWorkspace');
    expect(page).toContain('AttendanceConflictList');

    expect(page).toContain('openAdminReportContextAction');
    expect(page).toContain('saveAdminReportWorkspaceAction');
    expect(page).toContain('finalizeAdminReportWorkspaceAction');
    expect(page).toContain('reopenAdminReportWorkspaceAction');
    expect(page).toContain('sendAdminReportBatchAction');

    expect(page).not.toContain('prepareReportBatchAction');
    expect(page).not.toContain('approveAllReportSourcesAction');
    expect(page).not.toContain('sendReadyReportsAction');
    expect(page).not.toContain('ReportStudentReviewTable');
    expect(page).not.toContain("name=\"scopeType\"");
    expect(page).not.toContain("t('prepareStage')");
    expect(page).not.toContain("t('sendStage')");
  });

  it('exposes the approved administrator-facing workflow statuses', () => {
    const en = JSON.parse(read('messages/en.json'));
    const ar = JSON.parse(read('messages/ar.json'));

    for (const messages of [en, ar]) {
      expect(messages.reports.contextStatus).toEqual(
        expect.objectContaining({
          WAITING: expect.any(String),
          READY_FOR_REVIEW: expect.any(String),
          READY_TO_SEND: expect.any(String),
          SENT: expect.any(String),
          DELIVERY_ISSUE: expect.any(String)
        })
      );
    }
  });

  it('keeps a first-class Delivery Status route with status filtering', () => {
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

  it('keeps report preview read-only and delivery-aware', () => {
    const page = read(
      'src/app/[locale]/(protected)/(admin)/reports/[id]/page.tsx'
    );

    expect(page).toContain('PageHeader');
    expect(page).toContain('Card');
    expect(page).toContain('DataTable');
    expect(page).toContain('renderStudentReport');
    expect(page).toContain('renderStudentReportV2');
    expect(page).toContain('/reports/delivery-status');
  });
});
