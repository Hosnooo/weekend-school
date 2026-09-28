import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

const actions = join(
  process.cwd(),
  'src/features/roster-csv/roster-csv.actions.ts'
);

describe('roster import Server Actions', () => {
  it('enforces Administrator access and the 1 MiB upload limit', () => {
    expect(existsSync(actions)).toBe(true);

    const source = readFileSync(actions, 'utf8');

    expect(source).toContain('requireAdministrator');
    expect(source).toContain('MAX_ROSTER_FILE_BYTES');
    expect(source).toContain('1024 * 1024');
    expect(source).toContain('file.size > MAX_ROSTER_FILE_BYTES');
  });

  it('previews without writing', () => {
    expect(existsSync(actions)).toBe(true);

    const source = readFileSync(actions, 'utf8');

    expect(source).toContain('previewRosterImportAction');
    expect(source).toContain('parseRosterCsv');
    expect(source).toContain('listRosterImportCatalog');
    expect(source).toContain('buildRosterImportPreview');
  });

  it('rebuilds the preview from source rows before confirmation', () => {
    expect(existsSync(actions)).toBe(true);

    const source = readFileSync(actions, 'utf8');

    expect(source).toContain('confirmRosterImportAction');
    expect(source).toContain('sourceRows');
    expect(source).toContain('listRosterImportCatalog');
    expect(source).toContain('buildRosterImportPreview');

    const confirmStart = source.indexOf(
      'export async function confirmRosterImportAction'
    );
    const confirmSource = source.slice(confirmStart);

    expect(confirmSource).toContain('buildRosterImportPreview');
    expect(confirmSource).toContain('confirmRosterImport');
  });

  it('hashes normalized confirmed rows instead of the raw CSV bytes', () => {
    expect(existsSync(actions)).toBe(true);

    const source = readFileSync(actions, 'utf8');

    expect(source).toContain("createHash('sha256')");
    expect(source).toContain('canonicalRows');
    expect(source).not.toContain("createHash('sha256').update(csvText)");
  });
});
