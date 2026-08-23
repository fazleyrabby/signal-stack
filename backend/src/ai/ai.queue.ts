import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { AIService } from './ai.service';
import { RedisService } from './redis.service';
import { MetricsService } from './metrics.service';
import { ConfigService } from '@nestjs/config';
import { logEvent } from '../common/logger';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { signals } from '../database/schema';
import { eq, and, desc, or, ilike } from 'drizzle-orm';
import {
  PRIORITY_SCORES,
  AI_SUMMARY_QUEUE_KEY,
  TranslationPriority,
} from './translation.constants';

interface AIJob {
  id: string;
  title: string;
  content: string | null;
  score?: number;
  retryCount?: number;
  priority?: TranslationPriority;
  processAfter?: number;
}

const POLL_INTERVAL_MS = 500;

@Injectable()
export class AIQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AIQueue.name);

  private readonly maxWorkers: number;
  private readonly dailyLimit: number;
  private readonly processDelay: number;

  private activeWorkers = 0;
  private shuttingDown = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastProcessTime = 0;

  constructor(
    private readonly aiService: AIService,
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
    private readonly configService: ConfigService,
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
  ) {
    this.processDelay = parseInt(process.env.AI_PROCESS_DELAY || '1500');
    this.maxWorkers = parseInt(process.env.AI_MAX_WORKERS || '2');
    this.dailyLimit = parseInt(process.env.AI_DAILY_LIMIT || '150');
  }

  async onModuleInit() {
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);

    logEvent('info', 'ai_queue_active', {
      delay: this.processDelay,
      workers: this.maxWorkers,
      limit: this.dailyLimit,
    });

    // Re-queue unprocessed signals on startup (crash recovery)
    setTimeout(() => this.requeuePending(), 5000);
  }

  onModuleDestroy() {
    this.shuttingDown = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  private async poll() {
    if (this.shuttingDown || this.activeWorkers >= this.maxWorkers) return;

    // Enforce minimum spacing between jobs
    const elapsed = Date.now() - this.lastProcessTime;
    if (elapsed < this.processDelay) return;

    const item = await this.redis.zpopmin(AI_SUMMARY_QUEUE_KEY);
    if (!item) return;

    const [memberJson] = item;
    let job: AIJob;
    try {
      job = JSON.parse(memberJson);
    } catch {
      logEvent('error', 'ai_queue_parse_error', { raw: memberJson });
      return;
    }

    // Delayed retry: re-enqueue if not ready yet
    if (job.processAfter && Date.now() < job.processAfter) {
      // Re-insert with original score if backoff hasn't elapsed
      const priority = job.priority || 'MEDIUM';
      const score = PRIORITY_SCORES[priority] + job.processAfter / 1e13;
      await this.redis.zadd(AI_SUMMARY_QUEUE_KEY, score, memberJson);
      return;
    }

    this.lastProcessTime = Date.now();
    this.activeWorkers++;
    this.processJob(job).finally(() => {
      this.activeWorkers = Math.max(0, this.activeWorkers - 1);
    });
  }

  private async requeuePending() {
    try {
      // 1. Reset signals that have corrupted reasoning traces / boilerplate
      await this.db
        .update(signals)
        .set({
          aiSummary: null,
          aiProcessed: false,
          aiFailed: false,
          aiProvider: null,
        })
        .where(
          or(
            ilike(signals.aiSummary, '%<think%'),
            ilike(signals.aiSummary, '%</think>%'),
            ilike(signals.aiSummary, '%thinking process%'),
            ilike(signals.aiSummary, '%Analyze User Input%'),
          ),
        );

      // 2. Recover ALL unprocessed signals (no score gate), ordered high-score first
      const pending = await this.db
        .select({
          id: signals.id,
          title: signals.title,
          content: signals.content,
          score: signals.score,
        })
        .from(signals)
        .where(and(eq(signals.aiProcessed, false), eq(signals.aiFailed, false)))
        .orderBy(desc(signals.score))
        .limit(100);

      if (pending.length === 0) return;

      logEvent('info', 'ai_startup_requeue', { count: pending.length });

      for (const signal of pending) {
        await this.enqueue(
          {
            id: signal.id,
            title: signal.title,
            content: signal.content,
            score: signal.score ?? undefined,
          },
          scoreToPriority(signal.score ?? 0),
        );
      }
    } catch (err: any) {
      logEvent('warn', 'ai_startup_requeue_failed', { error: err.message });
    }
  }

  async enqueue(job: AIJob, priority: TranslationPriority = 'MEDIUM') {
    if (await this.redis.isProcessed(job.id)) return;

    const withinLimit = await this.redis.checkAndIncrementLimit(this.dailyLimit);
    if (!withinLimit) {
      logEvent('warn', 'ai_daily_limit_reached', { limit: this.dailyLimit });
      return;
    }

    const fullJob: AIJob = { ...job, priority, retryCount: job.retryCount || 0 };
    const score = PRIORITY_SCORES[priority] + Date.now() / 1e13;

    await this.redis.zadd(AI_SUMMARY_QUEUE_KEY, score, JSON.stringify(fullJob));
    await this.metrics.recordJob('ai_summary', 'enqueued');

    logEvent('info', 'ai_queue_enqueue', { signalId: job.id, priority });
  }

  private async processJob(job: AIJob) {
    try {
      await this.aiService.processSignal(
        job.id,
        job.title,
        job.content,
        job.score,
      );
      await this.redis.markProcessed(job.id);
      await this.metrics.recordJob('ai_summary', 'completed');
    } catch (error: any) {
      logEvent('error', 'ai_queue_job_failed', {
        jobId: job.id,
        error: error.message,
        retry: (job.retryCount || 0) + 1,
      });

      await this.metrics.recordJob('ai_summary', 'failed');

      const retries = job.retryCount || 0;
      if (retries < 3) {
        const backoffMs = (retries + 1) * 30_000;
        const retryJob: AIJob = {
          ...job,
          retryCount: retries + 1,
          processAfter: Date.now() + backoffMs,
        };
        const priority = job.priority || 'MEDIUM';
        const score = PRIORITY_SCORES[priority] + retryJob.processAfter! / 1e13;

        await this.redis.zadd(AI_SUMMARY_QUEUE_KEY, score, JSON.stringify(retryJob));

        logEvent('info', 'ai_queue_retry_scheduled', {
          jobId: job.id,
          retry: retries + 1,
          backoffMs,
        });
      }
    }
  }

  get queueSize(): number {
    return this.activeWorkers;
  }
}

function scoreToPriority(score: number): TranslationPriority {
  if (score >= 7) return 'HIGH';
  if (score >= 5) return 'MEDIUM';
  return 'LOW';
}
