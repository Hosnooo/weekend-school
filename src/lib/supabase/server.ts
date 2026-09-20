import 'server-only';

import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';

import {getPublicEnv} from '@/lib/env/public';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const environment = getPublicEnv();

  return createServerClient(environment.supabaseUrl, environment.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const {name, value, options} of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. The proxy refreshes them.
        }
      }
    }
  });
}
