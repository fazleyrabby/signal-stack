import { Injectable } from '@nestjs/common';
import { RawSignal, ScoredSignal } from '../common/types';
import { generateHash } from '../common/hash.util';
import { sources } from '../database/schema';
import { logEvent } from '../common/logger';

// --- Classical Scoring Rules (Fallback) ---
const KEYWORD_RULES: { points: number; keywords: string[] }[] = [
  {
    points: 6, // Critical / Urgent
    keywords: [
      'outage', 'attack', 'explosion', 'cyberattack', 'breach', 'shutdown',
      'vulnerability', 'zero-day', 'exploit', 'sanctions', 'invasion', 'war',
      'nuclear', 'assassination', 'coup', 'terrorism', 'embargo'
    ],
  },
  {
    points: 4, // Major Industry / Political shifts
    keywords: [
      'acquisition', 'merger', 'layoff', 'regulation', 'ban', 'censorship',
      'surveillance', 'leak', 'artificial intelligence', 'machine learning',
      'large language model', 'generative ai', 'ai safety', 'election',
      'legislation', 'treaty', 'protest', 'diplomatic', 'inflation', 'recession'
    ],
  },
  {
    points: 2, // General interest
    keywords: [
      'launch', 'partnership', 'funding', 'update', 'release', 'ai model',
      'open source ai', 'gpu', 'transformer', 'fine-tuning', 'chatbot',
      'autonomous', 'deepfake', 'semiconductor', 'quantum', 'space',
      'energy', 'climate', 'infrastructure'
    ],
  },
];

const NEGATIVE_KEYWORDS: { points: number; keywords: string[] }[] = [
  {
    points: -5, // Hard noise
    keywords: ['sponsored', 'advertisement', 'deal of the day', 'discount code', 'coupon'],
  },
  {
    points: -3, // Soft noise
    keywords: ['review:', 'hands-on', 'unboxing', 'gift guide', 'how to watch', 'best deals'],
  },
];

const ENTITY_RULES: { points: number; entities: string[]; regexes: RegExp[] }[] = [
  {
    points: 4, // Top Tier Entities
    entities: [
      'AWS', 'Amazon', 'Google', 'Microsoft', 'Cloudflare', 'OpenAI', 'Meta',
      'Apple', 'NVIDIA', 'Anthropic', 'Pentagon', 'White House', 'Kremlin',
      'NATO', 'EU', 'UN', 'China', 'Russia', 'Ukraine', 'Israel', 'Taiwan'
    ],
    regexes: [
      /\bAWS\b/i, /\bAmazon\b/i, /\bGoogle\b/i, /\bMicrosoft\b/i, /\bCloudflare\b/i,
      /\bOpenAI\b/i, /\bMeta\b/i, /\bApple\b/i, /\bNVIDIA\b/i, /\bAnthropic\b/i,
      /\bPentagon\b/i, /\bWhite House\b/i, /\bKremlin\b/i, /\bNATO\b/i, /\bEU\b/i,
      /\bUN\b/i, /\bChina\b/i, /\bRussia\b/i, /\bUkraine\b/i, /\bIsrael\b/i, /\bTaiwan\b/i
    ]
  },
];

function getSeverity(score: number): 'low' | 'medium' | 'high' {
  if (score >= 9) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

@Injectable()
export class ScorerService {
  constructor() {}

  async score(
    raw: RawSignal,
    source: typeof sources.$inferSelect,
  ): Promise<ScoredSignal> {
    const text = `${raw.title} ${raw.content || ''}`;
    const textLower = text.toLowerCase();

    let score = 0;

    // 1. Keyword Hits
    for (const rule of KEYWORD_RULES) {
      for (const keyword of rule.keywords) {
        if (textLower.includes(keyword)) {
          score += rule.points;
          break; // Count each point tier only once per signal to avoid inflation
        }
      }
    }

    // 2. Entity Hits
    for (const rule of ENTITY_RULES) {
      for (const regex of rule.regexes) {
        if (regex.test(text)) {
          score += rule.points;
          break; // Count top tier entities only once
        }
      }
    }

    // 3. Noise Reduction (Negative Keywords)
    for (const rule of NEGATIVE_KEYWORDS) {
      for (const keyword of rule.keywords) {
        if (textLower.includes(keyword)) {
          score += rule.points;
        }
      }
    }

    // 4. Source Trust (Base multiplier)
    score += source.trustScore;

    // 5. Capping & Normalization
    // Ensure scores stay within a reasonable 1-12 range
    if (score < 1) score = 1;
    if (score > 12) score = 12;

    if (isNaN(score)) score = 1;

    return {
      ...raw,
      score,
      severity: getSeverity(score),
      hash: generateHash(raw.title, raw.url),
    };
  }
}
