export const TRANSLATION_VERSION = 1;
export const SOFT_BLOCK_TIMEOUT_MS = 300;
export const TRANSLATION_LOCK_TTL = 120; // seconds
export const LOCK_HEARTBEAT_INTERVAL = 30_000; // ms
export const TRANSLATION_MAX_RETRIES = 3;
export const TRANSLATION_QUEUE_KEY = 'queue:translation';
export const AI_SUMMARY_QUEUE_KEY = 'queue:ai_summary';

export type TranslationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

// ZPOPMIN returns lowest score first → HIGH=10, MEDIUM=50, LOW=100
export const PRIORITY_SCORES: Record<TranslationPriority, number> = {
  HIGH: 10,
  MEDIUM: 50,
  LOW: 100,
} as const;

export interface TranslationEntry {
  title: string;
  aiSummary: string;
  v: number;
}
