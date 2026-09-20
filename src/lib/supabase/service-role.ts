import 'server-only';

import {createClient} from '@supabase/supabase-js';

import {getServerEnv} from '@/lib/env/server';

export function createServiceRoleSupabaseClient() {
  const environment = getServerEnv();
  return createClient(environment.supabaseUrl, environment.serviceRoleKey, {
    auth: {autoRefreshToken: false, persistSession: false}
  });
}
