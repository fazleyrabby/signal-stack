import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /admin routes (except /login)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    // Note: We can't check localStorage in Middleware (server-side),
    // so we look for a cookie. SignalStack uses bit-simple cookies for auth.
    const adminKey = request.cookies.get("signalstack_admin_auth")?.value;

    if (!adminKey) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
