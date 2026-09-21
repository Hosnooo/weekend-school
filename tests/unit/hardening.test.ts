import {readFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

function leafKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe('release hardening contracts', () => {
  it('keeps the English and Arabic message catalogs structurally identical', async () => {
    const [english, arabic] = await Promise.all([
      readFile(join(process.cwd(), 'messages', 'en.json'), 'utf8'),
      readFile(join(process.cwd(), 'messages', 'ar.json'), 'utf8')
    ]);

    expect(leafKeys(JSON.parse(arabic)).sort()).toEqual(leafKeys(JSON.parse(english)).sort());
  });

  it('documents every required setup and deployment topic without real secrets', async () => {
    const readme = await readFile(join(process.cwd(), 'README.md'), 'utf8');
    for (const heading of ['Prerequisites', 'Installation', 'Environment variables', 'Supabase setup', 'Database migration', 'Seed data', 'Development', 'Testing', 'Production build', 'Deployment']) {
      expect(readme).toContain(`## ${heading}`);
    }
    expect(readme).not.toMatch(/re_[A-Za-z0-9]{20,}/);
  });

  it('provides an idempotent bilingual seed with the specified fixture quantities', async () => {
    const seed = await readFile(join(process.cwd(), 'supabase', 'seed.sql'), 'utf8');
    expect(seed).toContain('on conflict');
    expect(seed.match(/-- seed-student:/g)).toHaveLength(12);
    expect(seed.match(/-- seed-teacher:/g)).toHaveLength(2);
    expect(seed.match(/-- seed-group:/g)).toHaveLength(3);
    expect(seed).toContain('مدرسة نهاية الأسبوع');
    expect(seed).toContain("'SUBMITTED'");
  });

  it('ships the real RLS matrix and exactly four named end-to-end workflows', async () => {
    const rls = await readFile(join(process.cwd(), 'supabase', 'tests', 'rls.test.sql'), 'utf8');
    for (const scenario of ['admin own school', 'assigned teacher', 'unrelated teacher', 'inactive profile', 'cross-school identifier', 'teacher cannot send reports']) {
      expect(rls).toContain(scenario);
    }

    const e2eFiles = (await readdir(join(process.cwd(), 'tests', 'e2e')))
      .filter((name) => name.endsWith('.spec.ts'))
      .sort();
    expect(e2eFiles).toEqual([
      'arabic-flow.spec.ts',
      'authorization.spec.ts',
      'english-flow.spec.ts',
      'student-exception.spec.ts'
    ]);
  });
});
