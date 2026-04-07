const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function loginAdmin(email: string, password: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  return res.ok;
}

export async function logoutAdmin(): Promise<void> {
  await fetch(`${API_BASE}/api/admin/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function refreshSession(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/admin/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  return res.ok;
}

export async function verifyAdminSession(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/admin/categories`, {
    credentials: "include",
  });
  return res.ok;
}
