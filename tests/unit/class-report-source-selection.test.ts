import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('Class Report Cycle source selection', () => {
  it('can re-include a source without auto-recomposing Admin report text', () => {
    const source = readFileSync(
      'src/features/reports/class-report-source.actions.ts',
      'utf8'
    );

    expect(source).toContain('set_report_cycle_source_included');
    expect(source).toContain('setClassReportCycleSourceIncluded');
    expect(source).not.toContain('approveAllSubmittedSources');
  });
});
