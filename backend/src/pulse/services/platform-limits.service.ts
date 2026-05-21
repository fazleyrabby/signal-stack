import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../ai/redis.service';
import { DraftsRepository } from '../drafts/drafts.repository';

export interface PlatformLimits {
  dailyLimit: number;
  hourlyLimit: number;
}

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
}

/**
 * Default limits per platform. These are the conservative safe values.
 * Operators can override via the pulse settings UI (stored in DB settings table).
 */
const DEFAULT_LIMITS: Record<string, PlatformLimits> = {
  x: { dailyLimit: 17, hourlyLimit: 5 },
  facebook: { dailyLimit: 25, hourlyLimit: 8 },
  linkedin: { dailyLimit: 10, hourlyLimit: 3 },
  bluesky: { dailyLimit: 30, hourlyLimit: 10 },
};

const FALLBACK_LIMITS: PlatformLimits = { dailyLimit: 10, hourlyLimit: 3 };

@Injectable()
export class PlatformLimitsService {
  private readonly logger = new Logger(PlatformLimitsService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly draftsRepository: DraftsRepository,
  ) {}

  /**
   * Returns effective limits for a platform.
   * DB overrides (set via admin settings) take precedence over defaults.
   */
  async getPlatformLimits(platform: string): Promise<PlatformLimits> {
    const defaults = DEFAULT_LIMITS[platform] ?? FALLBACK_LIMITS;

    const [dailyStr, hourlyStr] = await Promise.all([
      this.draftsRepository.findSetting(`pulse_limit_${platform}_daily`),
      this.draftsRepository.findSetting(`pulse_limit_${platform}_hourly`),
    ]);

    return {
      dailyLimit: dailyStr ? parseInt(dailyStr, 10) : defaults.dailyLimit,
      hourlyLimit: hourlyStr ? parseInt(hourlyStr, 10) : defaults.hourlyLimit,
    };
  }

  /**
   * Atomically checks and increments a publish counter.
   * Uses Redis INCR + EXPIRE for atomic daily/hourly counting.
   */
  async checkAndIncrement(
    platform: string,
    window: 'daily' | 'hourly',
  ): Promise<LimitCheckResult> {
    const limits = await this.getPlatformLimits(platform);
    const limit = window === 'daily' ? limits.dailyLimit : limits.hourlyLimit;

    const key = this.buildRedisKey(platform, window);
    const ttl = window === 'daily' ? 86400 + 3600 : 3600 + 300; // 25h / 65min

    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, ttl);
    }

    return {
      allowed: current <= limit,
      current,
      limit,
    };
  }

  /**
   * Returns the current counter value without incrementing.
   */
  async getCurrentCount(platform: string, window: 'daily' | 'hourly'): Promise<number> {
    const key = this.buildRedisKey(platform, window);
    const val = await this.redis.get(key);
    return val ? parseInt(val, 10) : 0;
  }

  /**
   * Returns live counters and configured limits for all platforms.
   * Used by the admin overview API endpoint.
   */
  async getAllPlatformStatus(): Promise<
    Record<string, { limits: PlatformLimits; dailyCount: number; hourlyCount: number }>
  > {
    const platforms = Object.keys(DEFAULT_LIMITS);
    const result: Record<string, any> = {};

    await Promise.all(
      platforms.map(async (platform) => {
        const [limits, dailyCount, hourlyCount] = await Promise.all([
          this.getPlatformLimits(platform),
          this.getCurrentCount(platform, 'daily'),
          this.getCurrentCount(platform, 'hourly'),
        ]);
        result[platform] = { limits, dailyCount, hourlyCount };
      }),
    );

    return result;
  }

  /**
   * Upserts custom limits for a platform into DB settings.
   */
  async setPlatformLimits(
    platform: string,
    limits: Partial<PlatformLimits>,
  ): Promise<void> {
    const updates: Promise<void>[] = [];

    if (limits.dailyLimit !== undefined) {
      updates.push(
        this.draftsRepository.upsertSetting(
          `pulse_limit_${platform}_daily`,
          String(limits.dailyLimit),
        ),
      );
    }
    if (limits.hourlyLimit !== undefined) {
      updates.push(
        this.draftsRepository.upsertSetting(
          `pulse_limit_${platform}_hourly`,
          String(limits.hourlyLimit),
        ),
      );
    }

    await Promise.all(updates);
    this.logger.log(`Updated platform limits for ${platform}: ${JSON.stringify(limits)}`);
  }

  private buildRedisKey(platform: string, window: 'daily' | 'hourly'): string {
    if (window === 'daily') {
      const today = new Date().toISOString().split('T')[0];
      return `pulse:${platform}:post_count:${today}`;
    }
    // Hourly: floor to current hour
    const now = new Date();
    const hour = `${now.toISOString().split('T')[0]}:${String(now.getUTCHours()).padStart(2, '0')}`;
    return `pulse:${platform}:post_count:${hour}`;
  }
}
