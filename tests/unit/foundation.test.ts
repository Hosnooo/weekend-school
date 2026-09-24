import {describe, expect, it} from 'vitest';

import {loginSchema} from '@/features/auth/auth.schemas';
import {languagePreferenceSchema} from '@/features/profiles/profile.schemas';
import {getNavigationItems} from '@/lib/auth/navigation';
import {getPublicEnv} from '@/lib/env/public';
import {getEmailEnv,getServerEnv} from '@/lib/env/server';
import {getLocaleDirection, isLocale} from '@/i18n/config';

describe('public environment', () => {
  it('rejects a missing Supabase URL before a client is created', () => {
    expect(() =>
      getPublicEnv({NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key'})
    ).toThrow('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('accepts the public Supabase settings used by browser clients', () => {
    expect(
      getPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://school.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key'
      })
    ).toEqual({
      supabaseUrl: 'https://school.supabase.co',
      supabaseAnonKey: 'public-anon-key'
    });
  });
});

describe('server environment', () => {
  it('rejects a missing service-role key', () => {
    expect(() =>
      getServerEnv({NEXT_PUBLIC_SUPABASE_URL: 'https://school.supabase.co'})
    ).toThrow('SUPABASE_SERVICE_ROLE_KEY');
  });
  it('validates email provider settings independently',()=>{expect(getEmailEnv({BREVO_API_KEY:'brevo-test',EMAIL_FROM:'Weekend School <mohssen.elshaar@gmail.com>'})).toEqual({brevoApiKey:'brevo-test',emailFrom:'Weekend School <mohssen.elshaar@gmail.com>'});expect(()=>getEmailEnv({BREVO_API_KEY:'brevo-test'})).toThrow('EMAIL_FROM');});
});

describe('locale configuration', () => {
  it('uses document-level RTL only for Arabic', () => {
    expect(getLocaleDirection('en')).toBe('ltr');
    expect(getLocaleDirection('ar')).toBe('rtl');
  });

  it('does not accept an unsupported locale', () => {
    expect(isLocale('fr')).toBe(false);
    expect(isLocale('ar')).toBe(true);
  });
});

describe('language preference validation', () => {
  it('accepts an application path and supported target locale', () => {
    expect(languagePreferenceSchema.parse({locale: 'ar', pathname: '/my-teaching'})).toEqual({
      locale: 'ar',
      pathname: '/my-teaching'
    });
  });

  it('rejects an external redirect path', () => {
    expect(
      languagePreferenceSchema.safeParse({
        locale: 'en',
        pathname: '//malicious.example/path'
      }).success
    ).toBe(false);
  });
});

describe('login validation', () => {
  it('normalizes a valid email and preserves the password', () => {
    expect(
      loginSchema.parse({email: '  Teacher@Example.COM ', password: 'secret'})
    ).toEqual({email: 'teacher@example.com', password: 'secret'});
  });

  it('rejects an empty password', () => {
    expect(
      loginSchema.safeParse({email: 'teacher@example.com', password: ''}).success
    ).toBe(false);
  });
});

describe('role navigation', () => {
  it('exposes only the two teacher destinations', () => {
    expect(getNavigationItems('TEACHER').map((item) => item.href)).toEqual([
      '/my-teaching',
      '/history'
    ]);
  });

  it('uses exactly the approved administrator navigation', () => {
    expect(getNavigationItems('ADMIN').map((item) => item.href)).toEqual([
      '/dashboard',
      '/classes',
      '/students',
      '/teachers',
      '/reports',
      '/settings'
    ]);
  });
});
