import { Injectable } from '@nestjs/common';
import { RawSignal, ScoredSignal } from '../common/types';
import { generateHash } from '../common/hash.util';
import { sources } from '../database/schema';

// --- Scoring Rules (configurable) ---

const KEYWORD_RULES: { points: number; keywords: string[] }[] = [
  {
    points: 5,
    keywords: [
      'outage', 'attack', 'explosion', 'cyberattack', 'breach',
      'shutdown', 'vulnerability', 'zero-day', 'exploit', 'sanctions',
    ],
  },
  {
    points: 3,
    keywords: [
      'acquisition', 'merger', 'layoff', 'regulation', 'ban',
      'censorship', 'surveillance', 'leak',
    ],
  },
  {
    points: 2,
    keywords: [
      'launch', 'partnership', 'funding', 'update', 'release',
    ],
  },
];

const ENTITY_RULES: { points: number; entities: string[] }[] = [
  {
    points: 3,
    entities: [
      'AWS', 'Amazon', 'Google', 'Microsoft', 'Cloudflare',
      'OpenAI', 'Meta', 'Apple', 'NVIDIA', 'Anthropic',
    ],
  },
  {
    points: 2,
    entities: [
      'Tesla', 'SpaceX', 'Stripe', 'Palantir', 'CrowdStrike',
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
  score(raw: RawSignal, source: typeof sources.$inferSelect): ScoredSignal {
    const text = `${raw.title} ${raw.content || ''}`.toLowerCase();
    let score = 0;

    // Keyword scoring
    for (const rule of KEYWORD_RULES) {
      for (const keyword of rule.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          score += rule.points;
        }
      }
    }

    // Entity scoring — use word-boundary-like matching for short entities
    for (const rule of ENTITY_RULES) {
      for (const entity of rule.entities) {
        const regex = new RegExp(`\\b${entity}\\b`, 'i');
        if (regex.test(`${raw.title} ${raw.content || ''}`)) {
          score += rule.points;
        }
      }
    }

    // Source trust bonus
    score += source.trustScore;

    // Guard against NaN
    if (isNaN(score)) {
      score = 0;
    }

    return {
      ...raw,
      score,
      severity: getSeverity(score),
      hash: generateHash(raw.title, raw.url),
    };
  }
}
