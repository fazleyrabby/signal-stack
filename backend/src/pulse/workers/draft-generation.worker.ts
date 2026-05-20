import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { RedisService } from '../../ai/redis.service';
import { PulseAIService } from '../services/pulse-ai.service';
import { DraftsRepository } from '../drafts/drafts.repository';
import { logEvent } from '../../common/logger';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { pulseDrafts } from '../../database/schema';
import { eq } from 'drizzle-orm';

const POLL_INTERVAL_MS = 1000;

interface DraftJob {
  id: string;
  title: string;
  aiSummary: string | null;
  categoryId: string;
  score: number;
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

  async enqueue(signal: { id: string; title: string; aiSummary: string | null; categoryId: string; score: number }) {
    // 1. Deduplicate by checking if a draft already exists for this signal
    const existing = await this.db
      .select({ id: pulseDrafts.id })
      .from(pulseDrafts)
      .where(eq(pulseDrafts.sourceSignalId, signal.id))
      .limit(1);

    if (existing.length > 0) {
      return;
    }

    // 2. Check if auto draft generation is enabled
    const autoEnabled = await this.draftsRepository.findSetting('pulse_auto_draft_enabled');
    if (autoEnabled === 'false') {
      return;
    }

    // 3. Check daily draft creation limit
    const limitStr = await this.draftsRepository.findSetting('pulse_max_drafts_per_day') || '20';
    const limit = parseInt(limitStr, 10);
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `pulse:draft_count:${today}`;
    const current = await this.redis.incr(dailyKey);

    if (current === 1) {
      await this.redis.expire(dailyKey, 86400 + 3600); // 25 hours TTL
    }

    if (current > limit) {
      logEvent('warn', 'pulse_daily_draft_limit_reached', { limit, count: current });
      return;
    }

    await this.pushToQueue(signal);
  }

  async forceEnqueue(signal: { id: string; title: string; aiSummary: string | null; categoryId: string; score: number }) {
    // Force enqueue bypasses setting checks & daily limits (triggered by manual admin action)
    await this.pushToQueue(signal);
  }

  private async pushToQueue(signal: { id: string; title: string; aiSummary: string | null; categoryId: string; score: number }) {
    const job: DraftJob = {
      id: signal.id,
      title: signal.title,
      aiSummary: signal.aiSummary,
      categoryId: signal.categoryId,
      score: signal.score,
      retryCount: 0,
    };
    // Prioritize by score. Higher score gets processed first (closer to 0 score in ZSET order)
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

    // If job process delay hasn't expired yet, re-enqueue
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
      const result = await this.pulseAIService.generateDraft(job);

      const draft = await this.draftsRepository.createDraft({
        sourceSignalId: job.id,
        platform: 'x',
        text: result.text,
        status: 'generated',
        aiProvider: result.provider,
        aiModel: result.model,
        metadata: {},
      });

      await this.draftsRepository.createPublishLog({
        draftId: draft.id,
        platform: 'x',
        action: 'generated',
        detail: `Successfully generated social media draft using ${result.provider} (${result.model})`,
      });

      logEvent('info', 'pulse_draft_generation_success', { signalId: job.id, draftId: draft.id });
    } catch (error: any) {
      logEvent('error', 'pulse_draft_generation_failed', {
        signalId: job.id,
        error: error.message,
        retry: (job.retryCount || 0) + 1,
      });

      const retries = job.retryCount || 0;
      if (retries < 3) {
        const backoffMs = (retries + 1) * 30_000;
        const retryJob: DraftJob = {
          ...job,
          retryCount: retries + 1,
          processAfter: Date.now() + backoffMs,
        };
        const score = (10 - job.score) * 1e12 + retryJob.processAfter!;
        await this.redis.zadd('queue:pulse_draft', score, JSON.stringify(retryJob));
      } else {
        logEvent('error', 'pulse_draft_generation_exhausted', { signalId: job.id });
      }
    }
  }
}
