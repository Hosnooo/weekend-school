import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('personal account authorization and non-retrievable passwords', () => {
  it('uses caller identity and row-level security rather than changing other users', () => {
    const actions = read('src/features/profiles/account.actions.ts');
    expect(actions).toContain('db.auth.getUser()');
    expect(actions).toContain(".eq('auth_user_id', user.id)");
    expect(actions).toContain('auth.updateUser');
    expect(actions).toContain('current_password: parsed.values.currentPassword');
    expect(actions).toContain('signInWithPassword');
    expect(actions).toContain("persistSession: false");
    expect(actions).toContain("scope: 'local'");
    expect(actions).not.toContain('service_role');
    expect(actions).not.toContain('updateUserById');
    expect(actions).not.toContain('encrypted_password');
  });

  it('shows one shared account screen and preserves Teacher bookmarks', () => {
    const nav = read('src/lib/auth/navigation.ts');
    const page = read('src/app/[locale]/(protected)/account/page.tsx');
    const redirect = read('src/app/[locale]/(protected)/(teacher)/profile/page.tsx');
    expect(nav).toContain("href: '/account'");
    expect(nav).not.toContain("href: '/profile'");
    expect(page).toContain('requireProfileWithCapabilities');
    expect(page).toContain('AccountWorkspace');
    expect(redirect).toContain('redirect(');
    expect(redirect).toContain('/account');
  });
});
