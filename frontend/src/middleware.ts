import createMiddleware from 'next-intl/middleware';
import { locales, localePrefix } from './navigation';

export default createMiddleware({
  locales,
  localePrefix,
  defaultLocale: 'en'
});

export const config = {
  matcher: ['/((?!api|admin|_next/static|_next/image|favicon.ico|.*\\..*).*)']
};
