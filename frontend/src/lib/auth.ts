import Cookies from "js-cookie";

export const ADMIN_KEY_COOKIE = "signalstack_admin_auth";

export function getAdminKey(): string | null {
  if (typeof window === "undefined") return null;
  return Cookies.get(ADMIN_KEY_COOKIE) || null;
}

export function setAdminKey(key: string) {
  // Store for 7 days
  Cookies.set(ADMIN_KEY_COOKIE, key, { expires: 7, path: '/' });
}

export function clearAdminKey() {
  Cookies.remove(ADMIN_KEY_COOKIE, { path: '/' });
}

export function isAdminAuthenticated(): boolean {
  return !!getAdminKey();
}
