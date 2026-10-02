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
});
