import fs from 'node:fs';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

const root = process.cwd();

function source(file: string) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const translatedServerSurfaces = [
  'src/app/[locale]/(protected)/(admin)/archives/page.tsx',
  'src/app/[locale]/(protected)/(admin)/exports/page.tsx',
  'src/app/[locale]/(protected)/(admin)/teaching-assignments/page.tsx'
];

const auditedInteractiveSurfaces = [
  ...translatedServerSurfaces,
  'src/features/attendance/attendance-conflict-list.tsx'
];

describe('whole-product visible-copy audit', () => {
  it('keeps Arabic UI copy in translation resources instead of application source', () => {
    const arabic = /[\u0600-\u06ff]/u;

    for (const file of auditedInteractiveSurfaces) {
      expect(source(file), file).not.toMatch(arabic);
    }
  });

  it('uses the translation system on audited server-rendered administration pages', () => {
    for (const file of translatedServerSurfaces) {
      const contents = source(file);
      expect(contents, file).toContain("from 'next-intl/server'");
      expect(contents, file).toContain('getTranslations');
    }
  });

  it('does not restore parallel locale copy objects on audited administration pages', () => {
    for (const file of translatedServerSurfaces) {
      const contents = source(file);

      expect(contents, file).not.toMatch(
        /locale\s*===\s*['"]ar['"]\s*\?\s*\{/
      );
    }
  });
});
