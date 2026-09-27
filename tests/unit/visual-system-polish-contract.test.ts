import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const root = process.cwd();
const source = (path: string) =>
  readFileSync(resolve(root, path), 'utf8');

describe('visual system polish contract', () => {
  it('loads intentional English and Arabic browser typography', () => {
    const layout = source('src/app/[locale]/layout.tsx');
    const globalCss = source('src/app/globals.css');

    expect(layout).toContain(
      "import '@fontsource/noto-sans-arabic/400.css';"
    );
    expect(layout).toContain(
      "import '@fontsource/noto-sans-arabic/600.css';"
    );

    expect(globalCss).toContain("[dir='rtl'] body");
    expect(globalCss).toContain("font-family: 'Noto Sans Arabic'");
    expect(globalCss).toContain("ui-sans-serif");
  });

  it('keeps choice controls out of full-width text-input sizing', () => {
    const globalCss = source('src/app/globals.css');

    expect(globalCss).toContain(":not([type='checkbox'])");
    expect(globalCss).toContain(":not([type='radio'])");
  });

  it('defines a clear record and page hierarchy', () => {
    const css = source('src/app/design-system.css');
    const studentForm = source('src/features/students/student-form.tsx');

    expect(css).toContain('--control-height: 2.5rem;');
    expect(css).toContain('.record-name');
    expect(css).toContain('.record-meta');
    expect(css).toContain('font-size: 1.75rem;');

    expect(studentForm).toContain('className="record-name"');
    expect(studentForm).toContain('className="record-meta"');
  });

  it('uses quieter shared management surfaces', () => {
    const css = source('src/app/design-system.css');

    expect(css).toContain('--border-subtle:');
    expect(css).toContain('min-height: 1.5rem;');
    expect(css).toContain('.data-table td:first-child strong');
    expect(css).toContain('.data-table tbody tr:hover');
    expect(css).toContain('.data-table caption');
    expect(css).toContain('position: absolute;');
  });
});
