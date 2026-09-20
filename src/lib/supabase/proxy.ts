import {createServerClient} from '@supabase/ssr';
import type {NextRequest, NextResponse} from 'next/server';

import {getPublicEnv} from '@/lib/env/public';

export async function refreshAuthSession(request: NextRequest, response: NextResponse) {
  const environment = getPublicEnv();
  const supabase = createServerClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const {name, value} of cookiesToSet) {
            request.cookies.set(name, value);
          }
          for (const {name, value, options} of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        }
      }
    }
  );

  await supabase.auth.getUser();
  return response;
}
