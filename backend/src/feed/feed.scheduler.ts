import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq, inArray, lt, notExists, sql } from 'drizzle-orm';
import { FeedService } from './feed.service';
import { SignalsService } from '../signals/signals.service';
import { DiscordService } from '../alerts/discord.service';
import { logEvent } from '../common/logger';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { bookmarks, signals } from '../database/schema';

@Injectable()
export class FeedScheduler implements OnModuleInit {
  private readonly alertCategories: Set<string>;
  private readonly signalRetentionDays: number;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
    private readonly feedService: FeedService,
    private readonly signalsService: SignalsService,
    private readonly discordService: DiscordService,
  ) {
    const categoriesFromEnv =
      process.env.DISCORD_ALERT_CATEGORIES
        ?.split(',')
        .map((category) => category.trim())
        .filter(Boolean) || ['technology'];
    this.alertCategories = new Set(categoriesFromEnv);

    const retentionDaysRaw = Number.parseInt(
      process.env.SIGNAL_RETENTION_DAYS || '90',
      10,
    );
    this.signalRetentionDays =
      Number.isFinite(retentionDaysRaw) && retentionDaysRaw > 0
        ? retentionDaysRaw
        : 90;
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

        // Alert if critical (>= 7) and category is enabled via env.
        if (
          signal.score >= 7 &&
          this.alertCategories.has(signal.categoryId || '')
        ) {
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

    try {
      const oldSignalIds = await this.db
        .select({ id: signals.id })
        .from(signals)
        .where(lt(signals.createdAt, cutoff));

      let deletedBookmarksForOldSignals = 0;
      if (oldSignalIds.length > 0) {
        const deletedBookmarks = await this.db
          .delete(bookmarks)
          .where(inArray(bookmarks.signalId, oldSignalIds.map((row) => row.id)))
          .returning({ id: bookmarks.id });
        deletedBookmarksForOldSignals = deletedBookmarks.length;
      }

      const deletedSignals = await this.db
        .delete(signals)
        .where(lt(signals.createdAt, cutoff))
        .returning({ id: signals.id });

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
        cutoff: cutoff.toISOString(),
        deletedSignals: deletedSignals.length,
        deletedBookmarksForOldSignals,
        deletedOrphanedBookmarks: deletedOrphanedBookmarks.length,
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
