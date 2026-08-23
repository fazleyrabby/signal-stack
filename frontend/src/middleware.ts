import createMiddleware from 'next-intl/middleware';
import { locales, localePrefix } from './navigation';
import type { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware({
  locales,
  localePrefix,
  defaultLocale: 'en'
});

export default function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  response.headers.set('CDN-Cache-Control', 'no-store');
  response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|admin|admin-login|generate-video|videos|$).*)'
  ]
};
