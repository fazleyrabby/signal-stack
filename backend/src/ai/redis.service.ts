import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { logEvent } from '../common/logger';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
    const port = this.configService.get<number>('REDIS_PORT') || 6379;

    try {
      this.client = new Redis({
        host,
        port,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });

      this.client.on('error', (err) => {
        logEvent('warn', 'redis_connection_error', { error: err.message });
      });

      this.client.on('connect', () => {
        logEvent('info', 'redis_connected', { host, port });
      });
    } catch (error: any) {
      logEvent('error', 'redis_init_failed', { error: error.message });
    }
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  /**
   * Check and increment the daily AI request count.
   * Resets at UTC midnight.
   */
  async checkAndIncrementLimit(limit: number): Promise<boolean> {
    if (!this.client || this.client.status !== 'ready') return true; // Fallback to pass-through if redis is down

    const key = `ai:daily_count:${new Date().toISOString().split('T')[0]}`;
    const count = await this.client.incr(key);

    if (count === 1) {
      await this.client.expire(key, 86400 + 3600); // 25 hours expiry
    }

    return count <= limit;
  }

  /**
   * Check if a signal ID is already in the deduplication cache.
   */
  async isProcessed(signalId: string): Promise<boolean> {
    if (!this.client || this.client.status !== 'ready') return false;
    const key = `ai:processed:${signalId}`;
    return (await this.client.exists(key)) === 1;
  }

  /**
   * Mark a signal as processed in the cache.
   */
  async markProcessed(signalId: string) {
    if (!this.client || this.client.status !== 'ready') return;
    const key = `ai:processed:${signalId}`;
    await this.client.set(key, '1', 'EX', 86400 * 7); // 7 days cache
  }

  /**
   * Track token usage for a provider. Stores in Redis with daily expiry.
   */
  async trackTokens(
    provider: string,
    promptTokens: number,
    completionTokens: number,
  ) {
    if (!this.client || this.client.status !== 'ready') return;
    const today = new Date().toISOString().split('T')[0];
    const promptKey = `ai:tokens:${provider}:prompt:${today}`;
    const completionKey = `ai:tokens:${provider}:completion:${today}`;

    await this.client.incrby(promptKey, promptTokens);
    await this.client.incrby(completionKey, completionTokens);

    // Expire at midnight UTC + 1 hour buffer
    await this.client.expire(promptKey, 86400 + 3600);
    await this.client.expire(completionKey, 86400 + 3600);
  }

  /**
   * Get token usage for a provider for today or all-time.
   */
  async getTokenUsage(
    provider: string,
    forToday = true,
  ): Promise<{ prompt: number; completion: number; total: number }> {
    if (!this.client || this.client.status !== 'ready') {
      return { prompt: 0, completion: 0, total: 0 };
    }

    if (forToday) {
      const today = new Date().toISOString().split('T')[0];
      const promptKey = `ai:tokens:${provider}:prompt:${today}`;
      const completionKey = `ai:tokens:${provider}:completion:${today}`;
      const [prompt, completion] = await Promise.all([
        this.client.get(promptKey),
        this.client.get(completionKey),
      ]);
      const p = parseInt(prompt || '0', 10);
      const c = parseInt(completion || '0', 10);
      return { prompt: p, completion: c, total: p + c };
    }

    // Get all-time (scan all keys)
    const promptTotal = await this.sumAllKeys(`ai:tokens:${provider}:prompt:*`);
    const completionTotal = await this.sumAllKeys(
      `ai:tokens:${provider}:completion:*`,
    );
    return {
      prompt: promptTotal,
      completion: completionTotal,
      total: promptTotal + completionTotal,
    };
  }

  private async sumAllKeys(pattern: string): Promise<number> {
    if (!this.client) return 0;
    let cursor = '0';
    let sum = 0;
    do {
      const [newCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = newCursor;
      if (keys.length > 0) {
        const values = await this.client.mget(keys);
        sum += values.reduce((acc, v) => acc + parseInt(v || '0', 10), 0);
      }
    } while (cursor !== '0');
    return sum;
  }
}
