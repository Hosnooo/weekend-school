import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

describe('roster Server Action exports', () => {
  it('does not export runtime constants from the use-server module', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/roster-csv/roster-csv.actions.ts'
      ),
      'utf8'
    );

    expect(source).toContain("'use server';");

    const exportedValues = [
      ...source.matchAll(
        /^export\s+(?:const|let|var)\s+([A-Za-z0-9_]+)/gm
      )
    ].map((match) => match[1]);

    expect(exportedValues).toEqual([]);
  });
});
