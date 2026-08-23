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

export function cleanDisplaySummary(text: string | null | undefined): string | null {
  if (!text) return null;
  let cleaned = text.trim();

  // Strip closed think blocks
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Strip unclosed think blocks
  cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '').trim();
  cleaned = cleaned.replace(/^[\s\S]*?<\/think>/gi, '').trim();

  // Strip special tokens & reasoning preambles
  cleaned = cleaned.replace(/<\|im_start\|>(?:system|assistant|user)?\s*/gi, '').trim();
  cleaned = cleaned.replace(/<\|im_end\|>/gi, '').trim();
  cleaned = cleaned.replace(/<pad>/gi, '').replace(/<\|.*?\|>/g, '').trim();
  cleaned = cleaned.replace(/^(?:Here's a thinking process|Thinking Process|Thought process):?\s*/i, '').trim();

  // If text is structured prompt echo / notes
  if (cleaned.includes('**Analyze User Input:**') || cleaned.includes('**Task:**') || cleaned.includes('**Constraints:**')) {
    return null;
  }

  // Normalize whitespace
  cleaned = cleaned.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

  if (cleaned.length < 10) return null;
  return cleaned;
}
