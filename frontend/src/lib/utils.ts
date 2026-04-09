import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface VisitorStats {
  total: number;
  today: number;
  realtime: number;
}

export async function fetchVisitorStats(): Promise<VisitorStats> {
  const res = await fetch(`${API_BASE}/api/visitors/stats`);
  if (!res.ok) throw new Error("Failed to fetch visitors");
  return res.json();
}

export async function trackVisit() {
  try {
    await fetch(`${API_BASE}/api/visitors`, { method: 'POST' });
  } catch {}
}
