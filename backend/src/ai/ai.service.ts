import { Injectable, Inject } from '@nestjs/common';
import { GroqProvider } from './providers/groq.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { signals } from '../database/schema';
import { eq } from 'drizzle-orm';
import { logEvent } from '../common/logger';

@Injectable()
export class AIService {
  constructor(
    private readonly groq: GroqProvider,
    private readonly openRouter: OpenRouterProvider,
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
  ) {}

  /**
   * Orchestrates the AI summary generation with Groq -> OpenRouter fallback.
   * Updates the database with the result or marks it as failed.
   */
  async processSignal(id: string, title: string, content: string | null) {
    const textContent = content || '';
    
    // 1. Try Groq (Primary)
    let summary = await this.groq.summarize(title, textContent);
    
    // 2. Fallback to OpenRouter if Groq fails
    if (!summary) {
      logEvent('info', 'ai_pipeline_fallback', { signalId: id });
      summary = await this.openRouter.summarize(title, textContent);
    }

    // 3. Update Database
    if (summary) {
      await this.db
        .update(signals)
        .set({
          aiSummary: summary,
          aiProcessed: true,
          aiFailed: false,
        })
        .where(eq(signals.id, id));
      
      logEvent('info', 'ai_processing_success', { signalId: id });
    } else {
      await this.db
        .update(signals)
        .set({
          aiProcessed: false,
          aiFailed: true,
        })
        .where(eq(signals.id, id));
      
      logEvent('error', 'ai_processing_failed_all_providers', { signalId: id });
    }
  }
}
