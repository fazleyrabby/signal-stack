import { Injectable } from '@nestjs/common';
import { RawSignal, ScoredSignal } from '../common/types';
import { generateHash } from '../common/hash.util';
import { sources } from '../database/schema';
import { logEvent } from '../common/logger';

// --- Classical Scoring Rules (Fallback) ---
const KEYWORD_RULES: { points: number; keywords: string[] }[] = [
  {
    points: 5,
    keywords: [
      'outage',
      'attack',
      'explosion',
      'cyberattack',
      'breach',
      'shutdown',
      'vulnerability',
      'zero-day',
      'exploit',
      'sanctions',
    ],
  },
  {
    points: 3,
    keywords: [
      'acquisition',
      'merger',
      'layoff',
      'regulation',
      'ban',
      'censorship',
      'surveillance',
      'leak',
      'artificial intelligence',
      'machine learning',
      'neural network',
      'large language model',
      'generative ai',
      'ai safety',
    ],
  },
  {
    points: 2,
    keywords: [
      'launch',
      'partnership',
      'funding',
      'update',
      'release',
      'ai model',
      'open source ai',
      'gpu',
      'transformer',
      'fine-tuning',
      'chatbot',
      'autonomous',
      'deepfake',
    ],
  },
];

const ENTITY_RULES: { points: number; entities: string[]; regexes: RegExp[] }[] = [
  {
    points: 3,
    entities: [
      'AWS',
      'Amazon',
      'Google',
      'Microsoft',
      'Cloudflare',
      'OpenAI',
      'Meta',
      'Apple',
      'NVIDIA',
      'Anthropic',
    ],
    regexes: [
      /\bAWS\b/i, /\bAmazon\b/i, /\bGoogle\b/i, /\bMicrosoft\b/i, /\bCloudflare\b/i,
      /\bOpenAI\b/i, /\bMeta\b/i, /\bApple\b/i, /\bNVIDIA\b/i, /\bAnthropic\b/i
    ]
  },
  {
    points: 2,
    entities: [
      'Tesla',
      'SpaceX',
      'Stripe',
      'Palantir',
      'CrowdStrike',
      'DeepMind',
      'Mistral',
      'Hugging Face',
      'Stability AI',
      'Cohere',
      'xAI',
      'Perplexity',
    ],
    regexes: [
      /\bTesla\b/i, /\bSpaceX\b/i, /\bStripe\b/i, /\bPalantir\b/i, /\bCrowdStrike\b/i,
      /\bDeepMind\b/i, /\bMistral\b/i, /\bHugging Face\b/i, /\bStability AI\b/i,
      /\bCohere\b/i, /\bxAI\b/i, /\bPerplexity\b/i
    ]
  },
];

function getSeverity(score: number): 'low' | 'medium' | 'high' {
  if (score >= 10) return 'high';
  if (score >= 7) return 'medium';
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

    // 1. Classical Keyword Scoring
    let score = 0;

    for (const rule of KEYWORD_RULES) {
      for (const keyword of rule.keywords) {
        if (textLower.includes(keyword)) {
          score += rule.points;
        }
      }
    }

    for (const rule of ENTITY_RULES) {
      for (const regex of rule.regexes) {
        if (regex.test(text)) {
          score += rule.points;
        }
      }
    }

    score += source.trustScore;

    if (isNaN(score)) score = 0;

    return {
      ...raw,
      score,
      severity: getSeverity(score),
      hash: generateHash(raw.title, raw.url),
    };
  }
}
