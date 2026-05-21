import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DraftsRepository } from '../drafts/drafts.repository';
import { DraftGenerationWorker } from '../workers/draft-generation.worker';
import { PublisherRegistry } from '../services/publisher-registry.service';
import { DiscordService } from '../../alerts/discord.service';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { signals, pulseDrafts } from '../../database/schema';
import { eq, and, desc, isNull, gte, inArray } from 'drizzle-orm';
import { logEvent } from '../../common/logger';

@Injectable()
export class PulseScheduler {
  private readonly logger = new Logger(PulseScheduler.name);
  private isPublishing = false;
  private isEnqueuing = false;

  constructor(
    private readonly draftsRepository: DraftsRepository,
    private readonly worker: DraftGenerationWorker,
    private readonly publisherRegistry: PublisherRegistry,
    private readonly discord: DiscordService,
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleAutoEnqueue() {
    if (this.isEnqueuing) return;
    this.isEnqueuing = true;

    try {
      const minScoreStr = (await this.draftsRepository.findSetting('pulse_min_signal_score')) || '7';
      const minScore = parseFloat(minScoreStr);

      const candidates = await this.db
        .select({
          id: signals.id,
          title: signals.title,
          aiSummary: signals.aiSummary,
          categoryId: signals.categoryId,
          score: signals.score,
          url: signals.url,
        })
        .from(signals)
        .leftJoin(pulseDrafts, eq(signals.id, pulseDrafts.sourceSignalId))
        .where(
          and(
            eq(signals.aiProcessed, true),
            eq(signals.aiFailed, false),
            isNull(pulseDrafts.id),
            gte(signals.score, minScore),
            inArray(signals.categoryId, ['ai', 'technology']),
          ),
        )
        .orderBy(desc(signals.score))
        .limit(10);

      for (const signal of candidates) {
        if (signal.score !== null) {
          await this.worker.enqueue({
            id: signal.id,
            title: signal.title,
            aiSummary: signal.aiSummary,
            categoryId: signal.categoryId,
            score: signal.score,
            sourceUrl: signal.url,
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Auto enqueue cron failed: ${err.message}`);
    } finally {
      this.isEnqueuing = false;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledPublishing() {
    if (this.isPublishing) return;
    this.isPublishing = true;

    try {
      const pendingDrafts = await this.draftsRepository.findScheduledDraftsToPublish();
      if (pendingDrafts.length === 0) return;

      for (const draft of pendingDrafts) {
        const platform = draft.platform || 'x';

        const activeAccount = await this.draftsRepository.findActiveAccount(platform);
        if (!activeAccount) {
          this.logger.warn(
            `No active ${platform} publishing account configured. Skipping draft ${draft.id}.`,
          );
          continue;
        }

        const publisher = this.publisherRegistry.getPublisher(platform);

        try {
          const res = await publisher.publish(draft.text, {
            apiKey: activeAccount.apiKey,
            apiSecret: activeAccount.apiSecret,
            accessToken: activeAccount.accessToken,
            accessTokenSecret: activeAccount.accessTokenSecret,
          });

          if (res.success) {
            await this.draftsRepository.updateDraft(draft.id, {
              status: 'published',
              publishedAt: new Date(),
            });
            await this.draftsRepository.createPublishLog({
              draftId: draft.id,
              platform,
              action: 'published',
              xPostId: res.postId,
              detail: `Successfully posted to ${platform} (Post ID: ${res.postId})`,
            });
            logEvent('info', 'pulse_publish_success', { draftId: draft.id, platform, postId: res.postId });
          } else {
            await this.handlePublishFailure(draft, platform, res.error || 'Unknown error');
          }
        } catch (err: any) {
          await this.handlePublishFailure(draft, platform, err.message);
        }
      }
    } catch (err: any) {
      this.logger.error(`Scheduled publishing cron failed: ${err.message}`);
    } finally {
      this.isPublishing = false;
    }
  }

  private async handlePublishFailure(
    draft: { id: string; retryCount: number },
    platform: string,
    error: string,
  ): Promise<void> {
    const nextRetries = draft.retryCount + 1;
    const isFinal = nextRetries >= 3;
    const newStatus = isFinal ? 'failed' : 'scheduled';
    const newScheduledAt = isFinal ? null : new Date(Date.now() + nextRetries * 5 * 60_000);

    await this.draftsRepository.updateDraft(draft.id, {
      status: newStatus,
      retryCount: nextRetries,
      scheduledAt: newScheduledAt,
    });

    await this.draftsRepository.createPublishLog({
      draftId: draft.id,
      platform,
      action: 'failed',
      detail: `Failed to post to ${platform}: ${error}. Retry: ${nextRetries}/3`,
    });

    logEvent('error', 'pulse_publish_failed', { draftId: draft.id, platform, error, retry: nextRetries });

    if (isFinal) {
      this.logger.error(`Draft ${draft.id} exhausted all ${platform} publish retries: ${error}`);
      // Notify via Discord on final failure
      await this.discord.sendPublishFailureAlert(draft.id, platform, error);
    }
  }
}
