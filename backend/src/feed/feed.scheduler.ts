import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FeedService } from './feed.service';
import { SignalsService } from '../signals/signals.service';
import { DiscordService } from '../alerts/discord.service';
import { logEvent } from '../common/logger';

@Injectable()
export class FeedScheduler implements OnModuleInit {
  constructor(
    private readonly feedService: FeedService,
    private readonly signalsService: SignalsService,
    private readonly discordService: DiscordService,
  ) {}

  async onModuleInit() {
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
    logEvent('info', 'feed_cycle_start', {});

    try {
      const scoredSignals = await this.feedService.fetchAllFeeds();
      let stored = 0;
      let discarded = 0;
      let duplicates = 0;
      let alerted = 0;

      for (const signal of scoredSignals) {
        // Discard low-value signals
        if (signal.score < 5) {
          discarded++;
          continue;
        }

        // Attempt to store (dedup handled inside)
        const wasInserted = await this.signalsService.insertSignal(signal);
        if (!wasInserted) {
          duplicates++;
          logEvent('info', 'duplicate_skipped', {
            source: signal.source,
            title: signal.title.slice(0, 80),
          });
          continue;
        }

        stored++;

        // Alert if score >= 7
        if (signal.score >= 7) {
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
}
