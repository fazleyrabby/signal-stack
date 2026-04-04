import { Injectable } from '@nestjs/common';
import { RawSignal, ScoredSignal } from '../common/types';
import { generateHash } from '../common/hash.util';
import { sources } from '../database/schema';
import { AIService } from './ai.service';
import { logEvent } from '../common/logger';

// --- Classical Scoring Rules (Fallback) ---
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
  constructor(private readonly aiService: AIService) {}

  async score(raw: RawSignal, source: typeof sources.$inferSelect): Promise<ScoredSignal> {
    const text = `${raw.title} ${raw.content || ''}`.toLowerCase();
    
    // 1. Semantic AI Scoring (Primary)
    const aiAnalysis = await this.aiService.analyzeSignal(raw.title, raw.content || '');
    
    if (aiAnalysis) {
      logEvent('info', 'ai_scoring_success', { 
        title: raw.title.slice(0, 50),
        score: aiAnalysis.score,
        category: aiAnalysis.aiCategory
      });

      return {
        ...raw,
        score: aiAnalysis.score + source.trustScore, // Combine AI intelligence with source reliability
        severity: getSeverity(aiAnalysis.score + source.trustScore),
        summary: aiAnalysis.summary,
        aiCategory: aiAnalysis.aiCategory,
        hash: generateHash(raw.title, raw.url),
      };
    }

    // 2. Fallback: Classical Keyword Scoring
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
