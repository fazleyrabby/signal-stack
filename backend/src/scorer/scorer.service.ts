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

const ENTITY_RULES: { points: number; entities: string[] }[] = [
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
    const text = `${raw.title} ${raw.content || ''}`.toLowerCase();

    // 1. Fallback: Classical Keyword Scoring
    let score = 0;

    for (const rule of KEYWORD_RULES) {
      for (const keyword of rule.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          score += rule.points;
        }
      }
    }

    for (const rule of ENTITY_RULES) {
      for (const entity of rule.entities) {
        const regex = new RegExp(`\\b${entity}\\b`, 'i');
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
