import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { RedisService } from '../../ai/redis.service';
import { PulseAIService } from '../services/pulse-ai.service';
import { DraftsRepository } from '../drafts/drafts.repository';
import { DiscordService } from '../../alerts/discord.service';
import { logEvent } from '../../common/logger';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { pulseAssets } from '../../database/schema';
import { eq } from 'drizzle-orm';

const POLL_INTERVAL_MS = 1000;

interface AssetJob {
  id: string;
  title: string;
  aiSummary: string | null;
  categoryId: string;
  score: number;
  sourceUrl?: string | null;
  retryCount?: number;
  processAfter?: number;
}

@Injectable()
export class DraftGenerationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DraftGenerationWorker.name);
  private activeWorkers = 0;
  private shuttingDown = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly maxWorkers = 2;

  constructor(
    private readonly redis: RedisService,
    private readonly pulseAIService: PulseAIService,
    private readonly draftsRepository: DraftsRepository,
    private readonly discord: DiscordService,
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
  ) {}

  onModuleInit() {
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    logEvent('info', 'pulse_worker_active', { maxWorkers: this.maxWorkers });
  }

  onModuleDestroy() {
    this.shuttingDown = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  async enqueue(signal: { id: string; title: string; aiSummary: string | null; categoryId: string; score: number; sourceUrl?: string | null }) {
    // Skip if canonical asset already exists for this signal
    const existing = await this.db
      .select({ id: pulseAssets.id })
      .from(pulseAssets)
      .where(eq(pulseAssets.signalId, signal.id))
      .limit(1);

    if (existing.length > 0) return;

    const autoEnabled = await this.draftsRepository.findSetting('pulse_auto_draft_enabled');
    if (autoEnabled === 'false') return;

    const limitStr = await this.draftsRepository.findSetting('pulse_max_drafts_per_day') || '20';
    const limit = parseInt(limitStr, 10);
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `pulse:asset_count:${today}`;
    const current = await this.redis.incr(dailyKey);

    if (current === 1) await this.redis.expire(dailyKey, 86400 + 3600);
    if (current > limit) {
      logEvent('warn', 'pulse_daily_asset_limit_reached', { limit, count: current });
      return;
    }

    await this.pushToQueue(signal);
  }

  async forceEnqueue(signal: { id: string; title: string; aiSummary: string | null; categoryId: string; score: number; sourceUrl?: string | null }) {
    await this.pushToQueue(signal);
  }

  private async pushToQueue(signal: AssetJob) {
    const job: AssetJob = {
      id: signal.id,
      title: signal.title,
      aiSummary: signal.aiSummary,
      categoryId: signal.categoryId,
      score: signal.score,
      sourceUrl: signal.sourceUrl,
      retryCount: 0,
    };
    const priorityScore = (10 - signal.score) * 1e12 + Date.now();
    await this.redis.zadd('queue:pulse_asset', priorityScore, JSON.stringify(job));
    logEvent('info', 'pulse_asset_enqueued', { signalId: signal.id, score: signal.score });
  }

  private async poll() {
    if (this.shuttingDown || this.activeWorkers >= this.maxWorkers) return;

    const item = await this.redis.zpopmin('queue:pulse_asset');
    if (!item) return;

    const [memberJson] = item;
    let job: AssetJob;
    try {
      job = JSON.parse(memberJson);
    } catch {
      logEvent('error', 'pulse_queue_parse_error', { raw: memberJson });
      return;
    }

    if (job.processAfter && Date.now() < job.processAfter) {
      const score = (10 - job.score) * 1e12 + job.processAfter;
      await this.redis.zadd('queue:pulse_asset', score, memberJson);
      return;
    }

    this.activeWorkers++;
    this.processJob(job).finally(() => {
      this.activeWorkers = Math.max(0, this.activeWorkers - 1);
    });
  }

  private async processJob(job: AssetJob) {
    try {
      const { asset, provider, model } = await this.pulseAIService.generateCanonicalAsset({
        id: job.id,
        title: job.title,
        aiSummary: job.aiSummary,
        categoryId: job.categoryId,
        score: job.score,
        sourceUrl: job.sourceUrl,
      });

      await this.db.insert(pulseAssets).values({
        signalId: job.id,
        title: asset.title,
        executiveSummary: asset.executiveSummary,
        detailedSummary: asset.detailedSummary ?? null,
        technicalBreakdown: asset.technicalBreakdown ?? null,
        whyItMatters: asset.whyItMatters ?? null,
        keyPoints: asset.keyPoints ?? [],
        sourceUrl: asset.sourceUrl ?? null,
        relatedLinks: asset.relatedLinks ?? [],
        tags: asset.tags ?? [],
        category: asset.category ?? null,
        severity: asset.severity ?? null,
        aiProvider: provider,
        aiModel: model,
      });

      logEvent('info', 'pulse_asset_created', { signalId: job.id, provider, model });
    } catch (error: any) {
      await this.handleJobFailure(job, error);
    }
  }

  private async handleJobFailure(job: AssetJob, error: Error) {
    logEvent('error', 'pulse_asset_generation_failed', {
      signalId: job.id,
      error: error.message,
      retry: (job.retryCount || 0) + 1,
    });

    const retries = job.retryCount || 0;
    if (retries < 3) {
      const backoffMs = (retries + 1) * 30_000;
      const retryJob: AssetJob = { ...job, retryCount: retries + 1, processAfter: Date.now() + backoffMs };
      const score = (10 - job.score) * 1e12 + retryJob.processAfter!;
      await this.redis.zadd('queue:pulse_asset', score, JSON.stringify(retryJob));
      return;
    }

    this.logger.error(`Asset generation exhausted for signal ${job.id}: ${error.message}`);
    logEvent('error', 'pulse_asset_generation_exhausted', { signalId: job.id, error: error.message });
    await this.discord.sendPulseFailureAlert(job.id, error.message);
  }
}
