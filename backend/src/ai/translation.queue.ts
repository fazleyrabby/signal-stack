import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { AIService } from './ai.service';
import { RedisService } from './redis.service';
import { Subject } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { signals } from '../database/schema';
import { eq, sql } from 'drizzle-orm';
import { logEvent } from '../common/logger';

interface TranslationJob {
  id: string;
  title: string;
  summary: string;
  lang: string;
}

@Injectable()
export class TranslationQueue implements OnModuleInit {
  private readonly logger = new Logger(TranslationQueue.name);
  private queue$ = new Subject<TranslationJob>();

  constructor(
    private readonly aiService: AIService,
    private readonly redis: RedisService,
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
  ) {}

  onModuleInit() {
    this.queue$.pipe(
      mergeMap((job) => this.processJob(job), 2) // Max 2 concurrent translations
    ).subscribe();
    
    this.logger.log('Translation Queue initialized (Async Worker)');
  }

  async enqueue(job: TranslationJob) {
    const lockKey = `lock:trans:${job.id}:${job.lang}`;
    
    // Attempt to acquire lock per signal + lang to prevent duplicate jobs
    const acquired = await this.redis.setLock(lockKey, 60);
    if (!acquired) return;

    logEvent('info', 'translation_queue_enqueue', { signalId: job.id, lang: job.lang });
    this.queue$.next(job);
  }

  private async processJob(job: TranslationJob) {
    const lockKey = `lock:trans:${job.id}:${job.lang}`;
    try {
      // 1. Double check DB before starting expensive AI call
      const [signal] = await this.db.select({ translations: signals.translations }).from(signals).where(eq(signals.id, job.id)).limit(1);
      const existing = (signal?.translations || {}) as Record<string, any>;
      if (existing[job.lang]) return;

      // 2. AI Translation Call
      const translated = await this.aiService.translate(job.title, job.summary, job.lang);
      
      if (translated) {
        // 3. Atomically update JSONB column
        await this.db.execute(sql`
          UPDATE signals 
          SET translations = jsonb_set(COALESCE(translations, '{}'), ${`{${job.lang}}`}, ${JSON.stringify(translated)}::jsonb)
          WHERE id = ${job.id}
        `);

        // 4. Invalidate Redis Cache
        await this.redis.del(`sig_cache:${job.id}:${job.lang}`);
        
        logEvent('info', 'translation_success', { signalId: job.id, lang: job.lang });
      }
    } catch (error: any) {
      logEvent('error', 'translation_failed', { signalId: job.id, lang: job.lang, error: error.message });
    } finally {
      // 5. Release Lock regardless of success
      await this.redis.del(lockKey);
    }
  }
}
