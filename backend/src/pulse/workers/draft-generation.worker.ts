import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { RedisService } from '../../ai/redis.service';
import { PulseAIService } from '../services/pulse-ai.service';
import { DraftsRepository } from '../drafts/drafts.repository';
import { DiscordService } from '../../alerts/discord.service';
import { logEvent } from '../../common/logger';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { pulseDrafts } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { XFormatter } from '../formatters/x.formatter';
import { FacebookFormatter } from '../formatters/facebook.formatter';
import { LinkedInFormatter } from '../formatters/linkedin.formatter';
import { BlueskyFormatter } from '../formatters/bluesky.formatter';
import type { PlatformFormatter } from '../formatters/base.formatter';

const POLL_INTERVAL_MS = 1000;

interface DraftJob {
  id: string;
  title: string;
  aiSummary: string | null;
  categoryId: string;
  score: number;
  sourceUrl?: string | null;
  retryCount?: number;
  processAfter?: number;
}

// Registry of all platform formatters
const FORMATTERS: PlatformFormatter[] = [
  new XFormatter(),
  new FacebookFormatter(),
  new LinkedInFormatter(),
  new BlueskyFormatter(),
];

const FORMATTER_MAP = new Map(FORMATTERS.map(f => [f.platform, f]));

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
    // Deduplicate: skip if any draft already exists for this signal
    const existing = await this.db
      .select({ id: pulseDrafts.id })
      .from(pulseDrafts)
      .where(eq(pulseDrafts.sourceSignalId, signal.id))
      .limit(1);

    if (existing.length > 0) return;

    const autoEnabled = await this.draftsRepository.findSetting('pulse_auto_draft_enabled');
    if (autoEnabled === 'false') return;

    const limitStr = await this.draftsRepository.findSetting('pulse_max_drafts_per_day') || '20';
    const limit = parseInt(limitStr, 10);
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `pulse:draft_count:${today}`;
    const current = await this.redis.incr(dailyKey);

    if (current === 1) await this.redis.expire(dailyKey, 86400 + 3600);
    if (current > limit) {
      logEvent('warn', 'pulse_daily_draft_limit_reached', { limit, count: current });
      return;
    }

    await this.pushToQueue(signal);
  }

  async forceEnqueue(signal: { id: string; title: string; aiSummary: string | null; categoryId: string; score: number; sourceUrl?: string | null }) {
    await this.pushToQueue(signal);
  }

  private async pushToQueue(signal: DraftJob) {
    const job: DraftJob = {
      id: signal.id,
      title: signal.title,
      aiSummary: signal.aiSummary,
      categoryId: signal.categoryId,
      score: signal.score,
      sourceUrl: signal.sourceUrl,
      retryCount: 0,
    };
    const priorityScore = (10 - signal.score) * 1e12 + Date.now();
    await this.redis.zadd('queue:pulse_draft', priorityScore, JSON.stringify(job));
    logEvent('info', 'pulse_draft_enqueued', { signalId: signal.id, score: signal.score });
  }

  private async poll() {
    if (this.shuttingDown || this.activeWorkers >= this.maxWorkers) return;

    const item = await this.redis.zpopmin('queue:pulse_draft');
    if (!item) return;

    const [memberJson] = item;
    let job: DraftJob;
    try {
      job = JSON.parse(memberJson);
    } catch {
      logEvent('error', 'pulse_queue_parse_error', { raw: memberJson });
      return;
    }

    if (job.processAfter && Date.now() < job.processAfter) {
      const score = (10 - job.score) * 1e12 + job.processAfter;
      await this.redis.zadd('queue:pulse_draft', score, memberJson);
      return;
    }

    this.activeWorkers++;
    this.processJob(job).finally(() => {
      this.activeWorkers = Math.max(0, this.activeWorkers - 1);
    });
  }

  private async processJob(job: DraftJob) {
    try {
      // 1. Generate canonical intelligence asset
      const { asset, provider, model } = await this.pulseAIService.generateCanonicalAsset({
        id: job.id,
        title: job.title,
        aiSummary: job.aiSummary,
        categoryId: job.categoryId,
        score: job.score,
        sourceUrl: job.sourceUrl,
      });

      // 2. Get all active social accounts
      const activeAccounts = await this.draftsRepository.findAllActiveAccounts();

      if (activeAccounts.length === 0) {
        // No accounts active — still create an X draft so admin can review/copy
        const formatter = FORMATTER_MAP.get('x')!;
        const post = formatter.format(asset);
        await this.createDraftRecord({ job, platform: 'x', text: post.text, provider, model, asset });
        logEvent('info', 'pulse_draft_created_no_accounts', { signalId: job.id });
        return;
      }

      // 3. Create one draft per active platform (dedup per signal+platform)
      for (const account of activeAccounts) {
        const platform = account.platform;
        const alreadyExists = await this.draftsRepository.draftExistsForSignalPlatform(job.id, platform);
        if (alreadyExists) continue;

        const formatter = FORMATTER_MAP.get(platform);
        if (!formatter) {
          this.logger.warn(`No formatter registered for platform: ${platform}`);
          continue;
        }

        const post = formatter.format(asset);
        await this.createDraftRecord({ job, platform, text: post.text, provider, model, asset });
      }

      logEvent('info', 'pulse_draft_generation_success', { signalId: job.id, platforms: activeAccounts.map(a => a.platform) });
    } catch (error: any) {
      await this.handleJobFailure(job, error);
    }
  }

  private async createDraftRecord(params: {
    job: DraftJob;
    platform: string;
    text: string;
    provider: string;
    model: string;
    asset: object;
  }) {
    const draft = await this.draftsRepository.createDraft({
      sourceSignalId: params.job.id,
      platform: params.platform,
      text: params.text,
      status: 'generated',
      aiProvider: params.provider,
      aiModel: params.model,
      metadata: { canonical: params.asset },
    });

    await this.draftsRepository.createPublishLog({
      draftId: draft.id,
      platform: params.platform,
      action: 'generated',
      detail: `Draft generated via ${params.provider} (${params.model}) for ${params.platform}`,
    });

    return draft;
  }

  private async handleJobFailure(job: DraftJob, error: Error) {
    logEvent('error', 'pulse_draft_generation_failed', {
      signalId: job.id,
      error: error.message,
      retry: (job.retryCount || 0) + 1,
    });

    const retries = job.retryCount || 0;
    if (retries < 3) {
      const backoffMs = (retries + 1) * 30_000;
      const retryJob: DraftJob = { ...job, retryCount: retries + 1, processAfter: Date.now() + backoffMs };
      const score = (10 - job.score) * 1e12 + retryJob.processAfter!;
      await this.redis.zadd('queue:pulse_draft', score, JSON.stringify(retryJob));
      return;
    }

    this.logger.error(`Draft generation exhausted for signal ${job.id}: ${error.message}`);
    logEvent('error', 'pulse_draft_generation_exhausted', { signalId: job.id, error: error.message });

    try {
      const failedDraft = await this.draftsRepository.createDraft({
        sourceSignalId: job.id,
        platform: 'x',
        text: `[AI GENERATION FAILED] Source: ${job.title}`,
        status: 'failed',
        retryCount: 3,
        metadata: { failureReason: error.message },
      });

      await this.draftsRepository.createPublishLog({
        draftId: failedDraft.id,
        platform: 'x',
        action: 'failed',
        detail: `AI generation exhausted after 3 retries: ${error.message}`,
      });

      await this.discord.sendPulseFailureAlert(job.id, error.message);
    } catch (persistErr: any) {
      this.logger.error(`Failed to persist exhausted draft: ${persistErr.message}`);
    }
  }
}
