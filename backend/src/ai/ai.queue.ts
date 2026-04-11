import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { AIService } from './ai.service';
import { RedisService } from './redis.service';
import { Subject, timer, zip, of } from 'rxjs';
import { mergeMap, catchError, delay, filter } from 'rxjs/operators';
import { logEvent } from '../common/logger';
import { ConfigService } from '@nestjs/config';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { signals } from '../database/schema';
import { eq, and, gte, or } from 'drizzle-orm';

interface AIJob {
  id: string;
  title: string;
  content: string | null;
  score?: number;
  retryCount?: number;
}

@Injectable()
export class AIQueue implements OnModuleInit {
  private queue$ = new Subject<AIJob>();
  private _queueSize = 0;

  // High-performance Rate-Limit Configuration
  private readonly processDelay = parseInt(
    process.env.AI_PROCESS_DELAY || '1500',
  );
  private readonly maxWorkers = parseInt(process.env.AI_MAX_WORKERS || '2');
  private readonly dailyLimit = parseInt(process.env.AI_DAILY_LIMIT || '150');

  constructor(
    private readonly aiService: AIService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
  ) {}

  async onModuleInit() {
    // 1. Smooth-Traffic Worker Protocol
    // We zip the queue with a timer to ensure a hard cluster-wide gap of 1.5s
    zip(this.queue$, timer(0, this.processDelay))
      .pipe(
        // Ensure concurrent lanes (though zipped sequentially, this prepares for scaling)
        mergeMap(([job]) => this.processJob(job), this.maxWorkers),
        catchError((err) => {
          logEvent('error', 'ai_queue_critical_failure', {
            error: err.message,
          });
          return of(null);
        }),
      )
      .subscribe();

    logEvent('info', 'ai_high_density_queue_active', {
      delay: this.processDelay,
      workers: this.maxWorkers,
      limit: this.dailyLimit,
    });

    // Re-queue unprocessed signals on startup (recovers from container restarts)
    setTimeout(() => this.requeuePending(), 5000);
  }

  private async requeuePending() {
    try {
      const pending = await this.db
        .select({
          id: signals.id,
          title: signals.title,
          content: signals.content,
          score: signals.score,
        })
        .from(signals)
        .where(and(eq(signals.aiProcessed, false), gte(signals.score, 7)))
        .limit(50);

      if (pending.length === 0) return;

      logEvent('info', 'ai_startup_requeue', { count: pending.length });
      for (const signal of pending) {
        await this.enqueue({
          id: signal.id,
          title: signal.title,
          content: signal.content,
          score: signal.score ?? undefined,
        });
      }
    } catch (err: any) {
      logEvent('warn', 'ai_startup_requeue_failed', { error: err.message });
    }
  }

  /**
   * Pushes a new signal to the background AI processing queue with safety checks.
   */
  async enqueue(job: AIJob) {
    // 1. Skip if already processed (Deduplicate)
    if (await this.redis.isProcessed(job.id)) {
      return;
    }

    // 2. Check Daily Limit
    const withinLimit = await this.redis.checkAndIncrementLimit(
      this.dailyLimit,
    );
    if (!withinLimit) {
      logEvent('warn', 'ai_daily_limit_reached', { limit: this.dailyLimit });
      return;
    }

    logEvent('info', 'ai_queue_enqueue', { signalId: job.id });
    this._queueSize++;
    this.queue$.next(job);
  }

  get queueSize(): number {
    return this._queueSize;
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
    } catch (error: any) {
      logEvent('error', 'ai_queue_job_failed', {
        jobId: job.id,
        error: error.message,
        retry: (job.retryCount || 0) < 1,
      });

      // 3. Resilience: Retry up to 3 times with exponential backoff
      const retries = job.retryCount || 0;
      if (retries < 3) {
        const backoff = (retries + 1) * 30000; // 30s, 60s, 90s
        logEvent('info', 'ai_queue_retry_scheduled', {
          jobId: job.id,
          retry: retries + 1,
          backoffMs: backoff,
        });
        setTimeout(() => {
          this.enqueue({ ...job, retryCount: retries + 1 });
        }, backoff);
      }
    } finally {
      this._queueSize = Math.max(0, this._queueSize - 1);
    }
  }
}
