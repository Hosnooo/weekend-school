import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

import {
  getDefaultAuthenticatedRoute,
  getNavigationItems
} from '@/lib/auth/navigation';

describe('multi-capability navigation', () => {
  it('keeps Teacher navigation out of an Administrator-only account', () => {
    const hrefs = getNavigationItems({isAdmin: true, teacherIds: []}).map(
      (item) => item.href
    );

    expect(hrefs).not.toContain('/my-teaching');
    expect(hrefs).toContain('/settings');
  });

  it('keeps Administrator navigation out of a Teacher-only account', () => {
    const hrefs = getNavigationItems({isAdmin: false, teacherIds: ['teacher-1']}).map(
      (item) => item.href
    );

    expect(hrefs).not.toContain('/settings');
    expect(hrefs).toContain('/my-teaching');
  });

  it('unions both navigation surfaces for a dual-capability account without duplicates', () => {
    const hrefs = getNavigationItems({isAdmin: true, teacherIds: ['teacher-1']}).map(
      (item) => item.href
    );

    expect(hrefs).toEqual(expect.arrayContaining(['/dashboard', '/my-teaching']));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('defaults Administrator and dual-capability accounts to the dashboard', () => {
    expect(getDefaultAuthenticatedRoute({isAdmin: true, teacherIds: []})).toBe(
      '/dashboard'
    );
    expect(
      getDefaultAuthenticatedRoute({isAdmin: true, teacherIds: ['teacher-1']})
    ).toBe('/dashboard');
  });

  it('defaults Teacher-only accounts to My Teaching and rejects accounts with no capability', () => {
    expect(
      getDefaultAuthenticatedRoute({isAdmin: false, teacherIds: ['teacher-1']})
    ).toBe('/my-teaching');
    expect(getDefaultAuthenticatedRoute({isAdmin: false, teacherIds: []})).toBeNull();
  });

  it('uses the explicit Administrator capability guard in the protected admin layout', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/app/[locale]/(protected)/(admin)/layout.tsx'
      ),
      'utf8'
    );

    expect(source).toContain('requireAdministrator');
    expect(source).not.toContain("requireProfile(locale, 'ADMIN')");
  });
});
