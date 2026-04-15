import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq, inArray, lt, notExists, sql, and, gte, or } from 'drizzle-orm';
import { FeedService } from './feed.service';
import { SignalsService } from '../signals/signals.service';
import { DiscordService } from '../alerts/discord.service';
import { RedisService } from '../ai/redis.service';
import { logEvent } from '../common/logger';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { bookmarks, signals } from '../database/schema';

@Injectable()
export class FeedScheduler implements OnModuleInit {
  private readonly alertCategories: Set<string>;
  private readonly signalRetentionDays: number;
  private readonly highScoreRetentionDays: number;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
    private readonly feedService: FeedService,
    private readonly signalsService: SignalsService,
    private readonly discordService: DiscordService,
    private readonly redis: RedisService,
  ) {
    const categoriesFromEnv =
      process.env.DISCORD_ALERT_CATEGORIES
        ?.split(',')
        .map((category) => category.trim())
        .filter(Boolean) || ['technology'];
    this.alertCategories = new Set(categoriesFromEnv);

    const retentionDaysRaw = Number.parseInt(
      process.env.SIGNAL_RETENTION_DAYS || '30',
      10,
    );
    this.signalRetentionDays =
      Number.isFinite(retentionDaysRaw) && retentionDaysRaw > 0
        ? retentionDaysRaw
        : 30;

    const highScoreRaw = Number.parseInt(
      process.env.HIGH_SCORE_RETENTION_DAYS || '90',
      10,
    );
    this.highScoreRetentionDays =
      Number.isFinite(highScoreRaw) && highScoreRaw > 0 ? highScoreRaw : 90;
  }

  async onModuleInit() {
    if (process.env.DISABLE_SCHEDULER === 'true') {
      logEvent('info', 'scheduler_is_disabled_via_env', {});
      return;
    }

    logEvent('info', 'startup_feed_trigger', {});
    // Wait a few seconds for services to properly initialize
    setTimeout(() => {
      this.handleFeedCycle().catch((err) => {
        logEvent('error', 'startup_trigger_failed', { error: err.message });
      });
    }, 5000);
  }

  /**
   * Run every 5 minutes. Fetches all feeds, stores qualifying signals,
   * and fires Discord alerts for high-severity items.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleFeedCycle() {
    if (process.env.DISABLE_SCHEDULER === 'true') {
      return;
    }
    logEvent('info', 'feed_cycle_start', {});

    try {
      const scoredSignals = await this.feedService.fetchAllFeeds();
      let stored = 0;
      let discarded = 0;
      let duplicates = 0;
      let alerted = 0;

      for (const signal of scoredSignals) {
        // Discard low-value signals (< 5)
        if (signal.score < 5) {
          discarded++;
          continue;
        }

        // Attempt to store
        const wasInserted = await this.signalsService.insertSignal(signal);
        if (!wasInserted) {
          duplicates++;
          continue;
        }

        stored++;

        // Logic: Technology (Medium+), Geopolitics (High only)
        const category = signal.categoryId || '';
        let shouldAlert = false;
 
        if (category === 'technology') {
          shouldAlert = signal.score >= 7; // Medium (7) or High (10)
        } else if (category === 'geopolitics') {
          shouldAlert = signal.score >= 10; // High (10) only
        } else {
          // For other categories, use the generic env-based toggle
          shouldAlert = signal.score >= 7 && this.alertCategories.has(category);
        }
 
        if (shouldAlert) {
          await this.discordService.sendAlert(signal);
          alerted++;
        }
      }

      logEvent('info', 'feed_cycle_complete', {
        total: scoredSignals.length,
        stored,
        discarded,
        duplicates,
        alerted,
      });
    } catch (error) {
      logEvent('error', 'feed_cycle_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Cron('0 2 * * *')
  async cleanupOldSignals() {
    const cutoff = new Date(
      Date.now() - this.signalRetentionDays * 24 * 60 * 60 * 1000,
    );
    const highScoreCutoff = new Date(
      Date.now() - this.highScoreRetentionDays * 24 * 60 * 60 * 1000,
    );

    try {
      // Dual retention: low-score signals expire sooner, high-score signals kept longer
      const expiredCondition = or(
        and(lt(signals.createdAt, cutoff), sql`${signals.score} < 7`),
        and(lt(signals.createdAt, highScoreCutoff), gte(signals.score, 7)),
      );

      const oldSignalRows = await this.db
        .select({ id: signals.id })
        .from(signals)
        .where(expiredCondition);

      const oldSignalIds = oldSignalRows.map((r) => r.id);

      let deletedBookmarksForOldSignals = 0;
      if (oldSignalIds.length > 0) {
        const deletedBookmarks = await this.db
          .delete(bookmarks)
          .where(inArray(bookmarks.signalId, oldSignalIds))
          .returning({ id: bookmarks.id });
        deletedBookmarksForOldSignals = deletedBookmarks.length;
      }

      const deletedSignals = await this.db
        .delete(signals)
        .where(expiredCondition)
        .returning({ id: signals.id });

      // Invalidate Redis cache for deleted signals
      for (const { id } of deletedSignals) {
        for (const lang of ['en', 'es', 'bn', 'fr', 'de', 'ar', 'zh']) {
          await this.redis.del(`sig_cache:${id}:${lang}`);
        }
        await this.redis.del(`ai:processed:${id}`);
      }

      const deletedOrphanedBookmarks = await this.db
        .delete(bookmarks)
        .where(
          notExists(
            this.db
              .select({ one: sql<number>`1` })
              .from(signals)
              .where(eq(signals.id, bookmarks.signalId)),
          ),
        )
        .returning({ id: bookmarks.id });

      logEvent('info', 'signal_retention_cleanup_complete', {
        retentionDays: this.signalRetentionDays,
        highScoreRetentionDays: this.highScoreRetentionDays,
        cutoff: cutoff.toISOString(),
        highScoreCutoff: highScoreCutoff.toISOString(),
        deletedSignals: deletedSignals.length,
        deletedBookmarksForOldSignals,
        deletedOrphanedBookmarks: deletedOrphanedBookmarks.length,
        cacheKeysInvalidated: deletedSignals.length * 7,
      });
    } catch (error) {
      logEvent('error', 'signal_retention_cleanup_failed', {
        retentionDays: this.signalRetentionDays,
        cutoff: cutoff.toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
