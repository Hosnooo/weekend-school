import createMiddleware from 'next-intl/middleware';
import type {NextRequest} from 'next/server';

import {routing} from '@/i18n/routing';
import {refreshAuthSession} from '@/lib/supabase/proxy';

const handleInternationalization = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const response = handleInternationalization(request);
  return refreshAuthSession(request, response);
}

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)'
};
