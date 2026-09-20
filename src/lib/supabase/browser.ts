'use client';

import {createBrowserClient} from '@supabase/ssr';

import {getPublicEnv} from '@/lib/env/public';

export function createBrowserSupabaseClient() {
  const environment = getPublicEnv();
  return createBrowserClient(environment.supabaseUrl, environment.supabaseAnonKey);
}
