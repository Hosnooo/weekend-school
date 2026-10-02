// @vitest-environment node

import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

function path(relative: string) {
  return join(process.cwd(), relative);
}

function read(relative: string) {
  return readFileSync(path(relative), 'utf8');
}

describe('Report Cycle visual hierarchy', () => {
  it('keeps workflow headings clear without oversized stage titles', () => {
    const stylesheetPath = 'src/app/report-cycle-hierarchy.css';
    const layout = read('src/app/[locale]/layout.tsx');

    expect(existsSync(path(stylesheetPath))).toBe(true);
    if (!existsSync(path(stylesheetPath))) return;

    const css = read(stylesheetPath);

    expect(layout).toContain("import '../report-cycle-hierarchy.css';");
    expect(css).toContain('.report-cycle-sources > .section-heading h2');
    expect(css).toContain('.report-email-review-panel > .section-heading h2');
    expect(css).toContain('.report-cycle-send > h2');
    expect(css).toContain('font-size: 1.125rem');
    expect(css).toContain('font-weight: 700');
    expect(css).not.toContain('font-size: 1.25rem');
    expect(css).toContain('.report-source-context-header');
    expect(css).toContain('.report-email-review-meta');
  });
});
