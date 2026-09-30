import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

describe('roster import hash contract', () => {
  it('does not hash the resolved Class id', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/roster-csv/roster-csv.actions.ts'),
      'utf8'
    );

    expect(source).toContain(
      '.map(({rowNumber, classId, ...canonical}) => {'
    );
    expect(source).toContain('void classId;');
  });
});
