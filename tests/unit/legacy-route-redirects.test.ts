import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const root = process.cwd();
const adminGroupsRoute = resolve(root, 'src/app/[locale]/(protected)/(admin)/groups/page.tsx');
const teacherGroupsRoute = resolve(root, 'src/app/[locale]/(protected)/(teacher)/my-groups/page.tsx');
const loginAction = resolve(root, 'src/app/[locale]/(auth)/login/actions.ts');

describe('legacy route cleanup', () => {
  it('keeps the old admin groups URL only as a locale-preserving redirect to Classes', () => {
    const source = readFileSync(adminGroupsRoute, 'utf8');
    expect(source).toContain("redirect(`/${locale}/classes`)");
  });

  it('keeps the old teacher groups URL only as a locale-preserving redirect to My Teaching', () => {
    expect(existsSync(teacherGroupsRoute)).toBe(true);
    const source = readFileSync(teacherGroupsRoute, 'utf8');
    expect(source).toContain("redirect(`/${locale}/my-teaching`)");
  });

  it('routes successful logins through the capability resolver and never restores My Groups', () => {
    const source = readFileSync(loginAction, 'utf8');
    expect(source).toContain('getDefaultAuthenticatedRoute');
    expect(source).toContain('redirect(`/${locale}${destination}`)');
    expect(source).not.toContain("`/${locale}/my-groups`");
  });
});
