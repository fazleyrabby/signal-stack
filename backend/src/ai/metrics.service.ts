import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface MetricsSnapshot {
  translation: {
    enqueued: number;
    completed: number;
    failed: number;
    latency: Record<string, { avgMs: number; count: number }>;
  };
  aiSummary: {
    enqueued: number;
    completed: number;
    failed: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRatio: number;
  };
  queue: {
    translationDepth: number;
    aiSummaryDepth: number;
  };
}

@Injectable()
export class MetricsService {
  constructor(private readonly redis: RedisService) {}

  private today(): string {
    return new Date().toISOString().split('T')[0];
  }

  async recordJob(
    type: 'translation' | 'ai_summary',
    status: 'enqueued' | 'completed' | 'failed',
  ): Promise<void> {
    const key = `metrics:${type}:${status}:${this.today()}`;
    await this.redis['client']?.incr(key);
    await this.redis['client']?.expire(key, 86400 + 3600);
  }

  async recordLatency(provider: string, durationMs: number): Promise<void> {
    const today = this.today();
    const sumKey = `metrics:latency:${provider}:sum:${today}`;
    const countKey = `metrics:latency:${provider}:count:${today}`;
    const client = this.redis['client'];
    if (!client) return;
    await Promise.all([
      client.incrbyfloat(sumKey, durationMs),
      client.incr(countKey),
      client.expire(sumKey, 86400 + 3600),
      client.expire(countKey, 86400 + 3600),
    ]);
  }

  async recordCacheHit(hit: boolean): Promise<void> {
    const key = `metrics:cache:${hit ? 'hit' : 'miss'}:${this.today()}`;
    await this.redis['client']?.incr(key);
    await this.redis['client']?.expire(key, 86400 + 3600);
  }

  async getMetrics(): Promise<MetricsSnapshot> {
    const today = this.today();
    const client = this.redis['client'];

    const safeInt = (v: string | null) => parseInt(v || '0', 10);
    const safeFloat = (v: string | null) => parseFloat(v || '0');

    const [
      tEnqueued, tCompleted, tFailed,
      aEnqueued, aCompleted, aFailed,
      cHits, cMisses,
    ] = await Promise.all([
      client?.get(`metrics:translation:enqueued:${today}`),
      client?.get(`metrics:translation:completed:${today}`),
      client?.get(`metrics:translation:failed:${today}`),
      client?.get(`metrics:ai_summary:enqueued:${today}`),
      client?.get(`metrics:ai_summary:completed:${today}`),
      client?.get(`metrics:ai_summary:failed:${today}`),
      client?.get(`metrics:cache:hit:${today}`),
      client?.get(`metrics:cache:miss:${today}`),
    ]);

    // Latency per translation mode (written by translation.queue.ts)
    const providers = ['speculative', 'sequential'];
    const latencyResults = await Promise.all(
      providers.map(async (p) => {
        const [sum, count] = await Promise.all([
          client?.get(`metrics:latency:${p}:sum:${today}`),
          client?.get(`metrics:latency:${p}:count:${today}`),
        ]);
        const c = safeInt(count as string | null);
        const s = safeFloat(sum as string | null);
        return { provider: p, avgMs: c > 0 ? Math.round(s / c) : 0, count: c };
      }),
    );

    const latency: Record<string, { avgMs: number; count: number }> = {};
    for (const { provider, avgMs, count } of latencyResults) {
      if (count > 0) latency[provider] = { avgMs, count };
    }

    const [translationDepth, aiSummaryDepth] = await Promise.all([
      this.redis.zcard('queue:translation'),
      this.redis.zcard('queue:ai_summary'),
    ]);

    const hits = safeInt(cHits as string | null);
    const misses = safeInt(cMisses as string | null);
    const total = hits + misses;

    return {
      translation: {
        enqueued: safeInt(tEnqueued as string | null),
        completed: safeInt(tCompleted as string | null),
        failed: safeInt(tFailed as string | null),
        latency,
      },
      aiSummary: {
        enqueued: safeInt(aEnqueued as string | null),
        completed: safeInt(aCompleted as string | null),
        failed: safeInt(aFailed as string | null),
      },
      cache: {
        hits,
        misses,
        hitRatio: total > 0 ? Math.round((hits / total) * 100) / 100 : 0,
      },
      queue: { translationDepth, aiSummaryDepth },
    };
  }
}
