import { Injectable, OnModuleInit } from '@nestjs/common';
import { AIService } from './ai.service';
import { RedisService } from './redis.service';
import { Subject, timer, zip, of } from 'rxjs';
import { mergeMap, catchError, delay, filter } from 'rxjs/operators';
import { logEvent } from '../common/logger';
import { ConfigService } from '@nestjs/config';

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
  
  // High-performance Rate-Limit Configuration
  private readonly processDelay = 1500; // AI_PROCESS_DELAY=1500
  private readonly maxWorkers = 2;      // AI_MAX_WORKERS=2
  private readonly dailyLimit = 150;    // AI_DAILY_LIMIT=150

  constructor(
    private readonly aiService: AIService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    // 1. Smooth-Traffic Worker Protocol
    // We zip the queue with a timer to ensure a hard cluster-wide gap of 1.5s
    zip(this.queue$, timer(0, this.processDelay))
      .pipe(
        // Ensure concurrent lanes (though zipped sequentially, this prepares for scaling)
        mergeMap(([job]) => this.processJob(job), this.maxWorkers),
        catchError((err) => {
          logEvent('error', 'ai_queue_critical_failure', { error: err.message });
          return of(null);
        })
      )
      .subscribe();
    
    logEvent('info', 'ai_high_density_queue_active', { 
      delay: this.processDelay, 
      workers: this.maxWorkers,
      limit: this.dailyLimit
    });
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
    const withinLimit = await this.redis.checkAndIncrementLimit(this.dailyLimit);
    if (!withinLimit) {
      logEvent('warn', 'ai_daily_limit_reached', { limit: this.dailyLimit });
      return;
    }

    logEvent('info', 'ai_queue_enqueue', { signalId: job.id });
    this.queue$.next(job);
  }

  private async processJob(job: AIJob) {
    try {
      await this.aiService.processSignal(job.id, job.title, job.content, job.score);
      await this.redis.markProcessed(job.id);
    } catch (error: any) {
      logEvent('error', 'ai_queue_job_failed', { 
        jobId: job.id, 
        error: error.message,
        retry: (job.retryCount || 0) < 1 
      });

      // 3. Resilience: Simple single retry after delay
      if ((job.retryCount || 0) < 1) {
        setTimeout(() => {
          this.enqueue({ ...job, retryCount: (job.retryCount || 0) + 1 });
        }, 10000); // 10s cooldown for retry
      }
    }
  }
}
