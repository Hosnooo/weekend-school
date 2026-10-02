// @vitest-environment node

import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

function read(relative: string) {
  return readFileSync(join(process.cwd(), relative), 'utf8');
}

describe('Settings width containment', () => {
  it('keeps nested Settings content inside the protected page column', () => {
    const css = read('src/app/design-system.css');

    expect(css).toContain('.settings-page-sections');
    expect(css).toContain('.settings-page-sections > *');
    expect(css).toContain('.settings-section-card');
    expect(css).toContain('.email-template-editor');
    expect(css).toContain('.email-template-preview-grid > *');
    expect(css).toContain('min-inline-size: 0');
    expect(css).toContain('max-inline-size: 100%');
    expect(css).toContain('overflow-wrap: anywhere');
  });

  it('keeps each live email preview inside a padded preview surface', () => {
    const css = read('src/app/design-system.css');

    expect(css).toContain('.email-template-preview-grid > .record-card');
    expect(css).toContain('padding: var(--space-4)');
  });

  it('removes the keyboard skip link from printed output', () => {
    const css = read('src/app/globals.css');

    expect(css).toContain('@media print');
    expect(css).toMatch(/@media print[\s\S]*\.skip-link[\s\S]*display:\s*none/);
  });
});
