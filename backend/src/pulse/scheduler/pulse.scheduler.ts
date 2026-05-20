import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DraftsRepository } from '../drafts/drafts.repository';
import { DraftGenerationWorker } from '../workers/draft-generation.worker';
import { XPublisher } from '../publishers/x.publisher';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { signals, pulseDrafts } from '../../database/schema';
import { eq, and, desc, isNull, gte } from 'drizzle-orm';
import { logEvent } from '../../common/logger';

@Injectable()
export class PulseScheduler {
  private readonly logger = new Logger(PulseScheduler.name);
  private isPublishing = false;
  private isEnqueuing = false;

  constructor(
    private readonly draftsRepository: DraftsRepository,
    private readonly worker: DraftGenerationWorker,
    private readonly publisher: XPublisher,
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleAutoEnqueue() {
    if (this.isEnqueuing) return;
    this.isEnqueuing = true;

    try {
      const minScoreStr = await this.draftsRepository.findSetting('pulse_min_signal_score') || '7';
      const minScore = parseFloat(minScoreStr);

      const candidates = await this.db
        .select({
          id: signals.id,
          title: signals.title,
          aiSummary: signals.aiSummary,
          categoryId: signals.categoryId,
          score: signals.score,
        })
        .from(signals)
        .leftJoin(pulseDrafts, eq(signals.id, pulseDrafts.sourceSignalId))
        .where(
          and(
            eq(signals.aiProcessed, true),
            eq(signals.aiFailed, false),
            isNull(pulseDrafts.id),
            gte(signals.score, minScore)
          )
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

      const activeAccount = await this.draftsRepository.findActiveAccount('x');
      if (!activeAccount) {
        this.logger.warn('No active X publishing account configured. Skipping scheduled posts.');
        return;
      }

      for (const draft of pendingDrafts) {
        try {
          const res = await this.publisher.publish(draft.text, {
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
              platform: 'x',
              action: 'published',
              xPostId: res.postId,
              detail: `Successfully posted to X (Post ID: ${res.postId})`,
            });
            logEvent('info', 'pulse_publish_success', { draftId: draft.id, postId: res.postId });
          } else {
            const nextRetries = draft.retryCount + 1;
            const newStatus = nextRetries >= 3 ? 'failed' : 'scheduled';
            const newScheduledAt = newStatus === 'scheduled'
              ? new Date(Date.now() + 5 * 60000)
              : null;

            await this.draftsRepository.updateDraft(draft.id, {
              status: newStatus,
              retryCount: nextRetries,
              scheduledAt: newScheduledAt,
            });

            await this.draftsRepository.createPublishLog({
              draftId: draft.id,
              platform: 'x',
              action: 'failed',
              detail: `Failed to post to X: ${res.error}. Retry: ${nextRetries}/3`,
            });
            logEvent('error', 'pulse_publish_failed', { draftId: draft.id, error: res.error });
          }
        } catch (err: any) {
          const nextRetries = draft.retryCount + 1;
          const newStatus = nextRetries >= 3 ? 'failed' : 'scheduled';
          const newScheduledAt = newStatus === 'scheduled'
            ? new Date(Date.now() + 5 * 60000)
            : null;

          await this.draftsRepository.updateDraft(draft.id, {
            status: newStatus,
            retryCount: nextRetries,
            scheduledAt: newScheduledAt,
          });

          await this.draftsRepository.createPublishLog({
            draftId: draft.id,
            platform: 'x',
            action: 'failed',
            detail: `Failed to post to X: ${err.message}. Retry: ${nextRetries}/3`,
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Scheduled publishing cron failed: ${err.message}`);
    } finally {
      this.isPublishing = false;
    }
  }
}
