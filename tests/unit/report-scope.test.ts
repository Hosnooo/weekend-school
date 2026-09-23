import {describe, expect, it} from 'vitest';

import {
  resolveReportPeriod,
  selectReportSectionsForScope
} from '@/features/reports/report.service';

const sections = [
  {classSubjectId: 'cs-quran', subjectGroupId: 'group-quran-a', label: 'Quran A'},
  {classSubjectId: 'cs-quran', subjectGroupId: 'group-quran-b', label: 'Quran B'},
  {classSubjectId: 'cs-arabic', subjectGroupId: null, label: 'Arabic whole class'}
];

describe('report period presets', () => {
  it('resolves week and month presets to inclusive calendar dates', () => {
    expect(resolveReportPeriod({preset: 'THIS_WEEK', today: '2026-09-23'})).toEqual({
      start: '2026-09-21',
      end: '2026-09-27'
    });
    expect(resolveReportPeriod({preset: 'LAST_WEEK', today: '2026-09-23'})).toEqual({
      start: '2026-09-14',
      end: '2026-09-20'
    });
    expect(resolveReportPeriod({preset: 'THIS_MONTH', today: '2026-09-23'})).toEqual({
      start: '2026-09-01',
      end: '2026-09-30'
    });
    expect(resolveReportPeriod({preset: 'LAST_MONTH', today: '2026-09-23'})).toEqual({
      start: '2026-08-01',
      end: '2026-08-31'
    });
  });

  it('uses explicit custom dates without storing a separate report type', () => {
    expect(
      resolveReportPeriod({
        preset: 'CUSTOM',
        today: '2026-09-23',
        customStart: '2026-09-05',
        customEnd: '2026-09-19'
      })
    ).toEqual({start: '2026-09-05', end: '2026-09-19'});
  });
});

describe('report scope selection', () => {
  it('keeps all applicable Subject sections for Class scope', () => {
    expect(selectReportSectionsForScope(sections, {type: 'CLASS'}).map(({label}) => label)).toEqual([
      'Quran A',
      'Quran B',
      'Arabic whole class'
    ]);
  });

  it('narrows Subject and Group scopes without mixing other sections', () => {
    expect(
      selectReportSectionsForScope(sections, {type: 'SUBJECT', classSubjectId: 'cs-quran'}).map(
        ({label}) => label
      )
    ).toEqual(['Quran A', 'Quran B']);

    expect(
      selectReportSectionsForScope(sections, {
        type: 'GROUP',
        classSubjectId: 'cs-quran',
        subjectGroupId: 'group-quran-b'
      }).map(({label}) => label)
    ).toEqual(['Quran B']);
  });
});
