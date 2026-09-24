import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

const repositoryRoot = process.cwd();

function filesUnder(relativeRoot: string): string[] {
  const absoluteRoot = path.join(repositoryRoot, relativeRoot);
  return readdirSync(absoluteRoot, {withFileTypes: true}).flatMap((entry) => {
    const relativePath = path.join(relativeRoot, entry.name);
    if (entry.isDirectory()) return filesUnder(relativePath);
    return [path.join(repositoryRoot, relativePath)];
  });
}

describe('independent-role release authority', () => {
  it('keeps current runtime code free of legacy single-role coupling', () => {
    const files = [
      ...filesUnder('src'),
      ...filesUnder('messages'),
      path.join(repositoryRoot, 'supabase', 'seed.e2e.sql')
    ];
    const forbidden = [
      ['profiles', '.role'].join(''),
      ['current', '_app_role'].join(''),
      ['teacher', '_profile_id'].join(''),
      ['administrator already has', ' an account'].join(''),
      ['teacher already has', ' an account'].join('')
    ];

    for (const filename of files) {
      const source = readFileSync(filename, 'utf8');
      for (const assumption of forbidden) {
        expect(source, `${path.relative(repositoryRoot, filename)} still contains ${assumption}`).not.toContain(assumption);
      }
    }
  });

  it('records the independent-role correction in the authoritative documents', () => {
    const spec = readFileSync(path.join(repositoryRoot, 'docs', 'SPEC.md'), 'utf8');
    const decisions = readFileSync(path.join(repositoryRoot, 'docs', 'DECISIONS.md'), 'utf8');
    const progress = readFileSync(path.join(repositoryRoot, 'docs', 'PROGRESS.md'), 'utf8');
    const design = readFileSync(
      path.join(repositoryRoot, 'docs', 'superpowers', 'specs', '2026-09-23-independent-role-records-design.md'),
      'utf8'
    );

    expect(spec).toContain('# 59. Independent Administrator and Teacher records (2026-09-24)');
    expect(spec).toContain('Export is Administrator-only');
    expect(decisions).toContain('## D-026 — Administrator and Teacher are independent business records');
    expect(progress).toContain('## Independent role records correction — implementation complete, release verification active (2026-09-24)');
    expect(design).toContain('**Status:** Approved and implemented; authoritative correction to `docs/SPEC.md`');
  });
});
