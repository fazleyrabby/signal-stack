import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Logger,
} from '@nestjs/common';
import { AIService } from './ai.service';
import { RedisService } from './redis.service';
import { MetricsService } from './metrics.service';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { signals } from '../database/schema';
import { eq, sql } from 'drizzle-orm';
import { logEvent } from '../common/logger';
import {
  TRANSLATION_VERSION,
  TRANSLATION_LOCK_TTL,
  LOCK_HEARTBEAT_INTERVAL,
  TRANSLATION_MAX_RETRIES,
  TRANSLATION_QUEUE_KEY,
  PRIORITY_SCORES,
  TranslationPriority,
  TranslationEntry,
} from './translation.constants';

interface TranslationJob {
  id: string;
  title: string;
  summary: string;
  lang: string;
  retryCount?: number;
  priority?: TranslationPriority;
  processAfter?: number; // epoch ms — for delayed retries
}

const MAX_CONCURRENCY = 2;
const POLL_INTERVAL_MS = 500;

@Injectable()
export class TranslationQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TranslationQueue.name);
  private activeWorkers = 0;
  private shuttingDown = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly aiService: AIService,
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
  ) {}

  onModuleInit() {
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    this.logger.log('Translation Queue initialized (Redis sorted set)');
  }

  onModuleDestroy() {
    this.shuttingDown = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.logger.log('Translation Queue shutting down');
  }

  private async poll() {
    if (this.shuttingDown || this.activeWorkers >= MAX_CONCURRENCY) return;

    const item = await this.redis.zpopmin(TRANSLATION_QUEUE_KEY);
    if (!item) return;

    const [memberJson] = item;
    let job: TranslationJob;
    try {
      job = JSON.parse(memberJson);
    } catch {
      logEvent('error', 'translation_queue_parse_error', { raw: memberJson });
      return;
    }

    // Delayed retry: re-enqueue if not ready yet
    if (job.processAfter && Date.now() < job.processAfter) {
      const priority = job.priority || 'MEDIUM';
      const score = PRIORITY_SCORES[priority] + job.processAfter / 1e13;
      await this.redis.zadd(TRANSLATION_QUEUE_KEY, score, memberJson);
      return;
    }

    this.activeWorkers++;
    this.processJob(job).finally(() => {
      this.activeWorkers = Math.max(0, this.activeWorkers - 1);
    });
  }

  async enqueue(job: Omit<TranslationJob, 'retryCount'>, priority: TranslationPriority = 'MEDIUM') {
    const lockKey = `lock:trans:${job.id}:${job.lang}`;
    const acquired = await this.redis.setLock(lockKey, TRANSLATION_LOCK_TTL);
    if (!acquired) return;

    const fullJob: TranslationJob = { ...job, retryCount: 0, priority };
    const score = PRIORITY_SCORES[priority] + Date.now() / 1e13;

    await this.redis.zadd(TRANSLATION_QUEUE_KEY, score, JSON.stringify(fullJob));
    await this.metrics.recordJob('translation', 'enqueued');

    logEvent('info', 'translation_queue_enqueue', {
      signalId: job.id,
      lang: job.lang,
      priority,
    });
  }

  private async processJob(job: TranslationJob) {
    const lockKey = `lock:trans:${job.id}:${job.lang}`;

    // Start heartbeat to keep lock alive during slow translations
    const heartbeat = setInterval(async () => {
      await this.redis.extendLock(lockKey, TRANSLATION_LOCK_TTL);
    }, LOCK_HEARTBEAT_INTERVAL);

    const start = Date.now();

    try {
      // Double-check DB before expensive AI call
      const [signal] = await this.db
        .select({ translations: signals.translations })
        .from(signals)
        .where(eq(signals.id, job.id))
        .limit(1);

      const existing = (signal?.translations || {}) as Record<string, TranslationEntry>;
      const existing_entry = existing[job.lang];

      // Skip if already translated with current version
      if (existing_entry && existing_entry.v === TRANSLATION_VERSION) return;

      // HIGH priority → speculative parallel execution
      const priority = job.priority || 'MEDIUM';
      const translated =
        priority === 'HIGH'
          ? await this.aiService.translateSpeculative(job.title, job.summary, job.lang)
          : await this.aiService.translate(job.title, job.summary, job.lang);

      if (translated) {
        const entry: TranslationEntry = {
          title: translated.title,
          aiSummary: translated.aiSummary,
          v: TRANSLATION_VERSION,
        };

        // Atomic JSONB update
        await this.db.execute(sql`
          UPDATE signals
          SET translations = jsonb_set(
            COALESCE(translations, '{}'),
            ${`{${job.lang}}`},
            ${JSON.stringify(entry)}::jsonb
          )
          WHERE id = ${job.id}
        `);

        // Invalidate cache
        await this.redis.del(`sig_cache:${job.id}:${job.lang}`);

        const durationMs = Date.now() - start;
        await this.metrics.recordJob('translation', 'completed');
        await this.metrics.recordLatency(
          priority === 'HIGH' ? 'speculative' : 'sequential',
          durationMs,
        );

        logEvent('info', 'translation_success', {
          signalId: job.id,
          lang: job.lang,
          durationMs,
          priority,
        });
      }
    } catch (error: any) {
      const retries = job.retryCount || 0;
      logEvent('error', 'translation_failed', {
        signalId: job.id,
        lang: job.lang,
        error: error.message,
        retry: retries,
      });

      await this.metrics.recordJob('translation', 'failed');

      if (retries < TRANSLATION_MAX_RETRIES) {
        const backoffMs = (retries + 1) * 30_000;
        const retryJob: TranslationJob = {
          ...job,
          retryCount: retries + 1,
          processAfter: Date.now() + backoffMs,
        };
        const priority = job.priority || 'MEDIUM';
        const score = PRIORITY_SCORES[priority] + retryJob.processAfter! / 1e13;
        await this.redis.zadd(TRANSLATION_QUEUE_KEY, score, JSON.stringify(retryJob));

        logEvent('info', 'translation_retry_scheduled', {
          signalId: job.id,
          lang: job.lang,
          retry: retries + 1,
          backoffMs,
        });
      }
    } finally {
      clearInterval(heartbeat);
      await this.redis.del(lockKey);
    }
  }

  get queueDepth(): Promise<number> {
    return this.redis.zcard(TRANSLATION_QUEUE_KEY);
  }
}
