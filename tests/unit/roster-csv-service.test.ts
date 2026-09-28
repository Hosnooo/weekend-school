import {TextDecoder} from 'node:util';

import {describe, expect, it} from 'vitest';

import {
  BASE_ROSTER_HEADERS,
  MAX_ROSTER_ROWS,
  buildRosterTemplate,
  parseRosterCsv,
  serializeCsv
} from '@/features/roster-csv/roster-csv.service';

const decoder = new TextDecoder();

describe('roster CSV codec', () => {
  it('parses BOM, CRLF, quoted commas, escaped quotes, and Arabic', () => {
    const csv = [
      '\uFEFFstudent_first_name_en,student_last_name_en,student_first_name_ar,student_last_name_ar,guardian_name,guardian_email,guardian_phone,report_language,class,enrollment_start_date,Quran group',
      '"Sara, A",Ali,سارة,علي,"Ahmed ""Abu"" Ali",PARENT@EXAMPLE.COM,7805550101,both,Level 1,2026-09-01,"Group, A"'
    ].join('\r\n');

    const result = parseRosterCsv(csv);

    expect(result.headers).toContain('Quran group');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      rowNumber: 2,
      values: expect.objectContaining({
        student_first_name_en: 'Sara, A',
        student_first_name_ar: 'سارة',
        guardian_name: 'Ahmed "Abu" Ali',
        guardian_email: 'PARENT@EXAMPLE.COM',
        'Quran group': 'Group, A'
      })
    });
  });

  it('parses LF line endings', () => {
    const csv = [
      BASE_ROSTER_HEADERS.join(','),
      'Sara,Ali,,,Ahmed Ali,parent@example.com,7805550101,en,Level 1,2026-09-01'
    ].join('\n');

    expect(parseRosterCsv(csv).rows).toHaveLength(1);
  });

  it('rejects malformed quoted CSV', () => {
    expect(() =>
      parseRosterCsv(
        `${BASE_ROSTER_HEADERS.join(',')}\r\n"unclosed,Ali,,,Guardian,parent@example.com,7805550101,en,Level 1,2026-09-01`
      )
    ).toThrow(/CSV/i);
  });

  it('allows 500 rows and rejects 501 rows', () => {
    const header = BASE_ROSTER_HEADERS.join(',');
    const row =
      'Sara,Ali,,,Ahmed Ali,parent@example.com,7805550101,en,Level 1,2026-09-01';

    const allowed = [header, ...Array.from({length: MAX_ROSTER_ROWS}, () => row)].join('\n');
    expect(parseRosterCsv(allowed).rows).toHaveLength(500);

    const tooMany = [
      header,
      ...Array.from({length: MAX_ROSTER_ROWS + 1}, () => row)
    ].join('\n');

    expect(() => parseRosterCsv(tooMany)).toThrow(/500/);
  });

  it('builds the school template with stable base columns and dynamic Subject columns', () => {
    const bytes = buildRosterTemplate([
      {id: 'subject-quran', nameEn: 'Quran'},
      {id: 'subject-arabic', nameEn: 'Arabic'}
    ]);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

    const text = decoder.decode(bytes);
    expect(text).toBe(
      `${[
        ...BASE_ROSTER_HEADERS,
        'Quran group',
        'Arabic group'
      ].join(',')}\r\n`
    );
  });

  it('protects CSV cells from spreadsheet formulas', () => {
    const text = decoder.decode(
      serializeCsv(
        ['student', 'note'],
        [{student: '=2+2', note: '@SUM(A1:A2)'}]
      )
    );

    expect(text).toContain("'=2+2");
    expect(text).toContain("'@SUM(A1:A2)");
    expect(text.endsWith('\r\n')).toBe(true);
  });
});
