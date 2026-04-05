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
}
