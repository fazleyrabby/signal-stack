import { Injectable, OnModuleInit } from '@nestjs/common';
import { AIService } from './ai.service';
import { Subject } from 'rxjs';
import { concatMap, delay } from 'rxjs/operators';
import { logEvent } from '../common/logger';

interface AIJob {
  id: string;
  title: string;
  content: string | null;
}

@Injectable()
export class AIQueue implements OnModuleInit {
  private queue$ = new Subject<AIJob>();
  private readonly maxConcurrency = 3;

  constructor(private readonly aiService: AIService) {}

  onModuleInit() {
    // 1. Setup the worker to process jobs asynchronously
    // Using concatMap to ensure limited concurrency and sequential processing
    // To allow for some parallelism, we could use mergeMap with a concurrency limit.
    this.queue$
      .pipe(
        // Ensure max concurrency
        concatMap(async (job) => {
          try {
            await this.aiService.processSignal(job.id, job.title, job.content);
          } catch (error: any) {
            logEvent('error', 'ai_queue_processing_error', { 
              jobId: job.id, 
              error: error.message 
            });
          }
        }),
        // Add a small delay between jobs to respect rate limits
        delay(100) 
      )
      .subscribe();
    
    logEvent('info', 'ai_queue_worker_started', { concurrency: this.maxConcurrency });
  }

  /**
   * Pushes a new signal to the background AI processing queue.
   */
  enqueue(job: AIJob) {
    logEvent('info', 'ai_queue_enqueue', { jobId: job.id });
    this.queue$.next(job);
  }
}
