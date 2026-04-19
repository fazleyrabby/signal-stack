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

export function getProviderLabel(provider: string | null): string {
  if (!provider || provider === 'none') return '';
  const labels: Record<string, string> = {
    'groq': 'Groq Cloud',
    'openrouter': 'OpenRouter',
    'local': 'VPS Local',
    'pico_router': 'PicoClaw Router',
    'pico_mac': 'PicoClaw Mac',
    'pico_fallback': 'PicoClaw Fallback',
    'mac_local': 'PicoClaw Mac',
    'failed': 'Failed',
  };
  return labels[provider] || provider;
}
