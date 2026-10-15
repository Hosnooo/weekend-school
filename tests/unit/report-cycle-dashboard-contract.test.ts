import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Admin Reports dashboard', () => {
  const list = read('src/app/[locale]/(protected)/(admin)/reports/page.tsx');
  const workspace = read('src/app/[locale]/(protected)/(admin)/reports/workspace/[batchId]/page.tsx');
  const repository = read('src/features/reports/report-batch.repository.ts');
  const refresh = read('src/features/reports/report-cycles-auto-refresh.tsx');

  it('separates unsent work from the last completed deliveries', () => {
    expect(list).toContain('openCycles.map(renderCycle)');
    expect(list).toContain('sentCycles.slice(0, 5).map(renderCycle)');
    expect(list).toContain('right.latestSentAt ?? right.createdAt');
    expect(list).toContain("t('cycleLastSent'");
  });

  it('derives labels from the latest student report revisions on both views', () => {
    expect(repository).toContain('deriveClassReportCycleDisplayStatus(status, currentReports)');
    expect(repository).toContain('deriveClassReportCycleDisplayStatus(workspace.batch.status, currentReports)');
    expect(repository).toContain('selectLatestReportRevisionsByStudent');
    expect(list).toContain('cycle.displayStatus');
    expect(workspace).toContain('classCycle.displayStatus');
  });

  it('refreshes just the Reports list at a reasonable rate while visible', () => {
    expect(list).toContain('<ReportCyclesAutoRefresh />');
    expect(refresh).toContain('document.visibilityState');
    expect(refresh).toContain('60_000');
    expect(refresh).toContain('router.refresh()');
  });

  it('keeps both languages aligned', () => {
    for (const language of ['en','ar']) {
      const dictionary = JSON.parse(read(`messages/${language}.json`));
      for (const status of ['READY_TO_SEND', 'PARTIALLY_SENT', 'SENT', 'DELIVERY_ISSUE']) {
        expect(dictionary.reports.cycleStatus[status]).toBeTruthy();
      }
      expect(dictionary.reports.openReportCyclesTitle).toBeTruthy();
      expect(dictionary.reports.recentlySentCyclesTitle).toBeTruthy();
    }
  });
});
