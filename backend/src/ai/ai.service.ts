import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GroqProvider } from './providers/groq.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { signals } from '../database/schema';
import { eq } from 'drizzle-orm';
import { logEvent } from '../common/logger';

@Injectable()
export class AIService {
  private readonly cooldowns = new Map<string, number>();
  private readonly retryLimit = 1;

  constructor(
    private readonly groq: GroqProvider,
    private readonly openRouter: OpenRouterProvider,
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Resilience-focused signal processing with provider-aware logic.
   */
  async processSignal(id: string, title: string, content: string | null) {
    const textContent = content || '';
    let summary: string | null = null;
    let fallbackUsed = false;

    // 1. Try Groq (Primary)
    if (!this.isCooldown('groq')) {
      summary = await this.groq.summarize(title, textContent);
      if (!summary && this.groq.lastError === 429) {
        this.setCooldown('groq', 60000);
      }
    }

    // 2. Fallback to OpenRouter (Secondary)
    if (!summary && !this.isCooldown('openrouter')) {
      logEvent('info', 'ai_pipeline_fallback', { signalId: id });
      fallbackUsed = true;
      summary = await this.openRouter.summarize(title, textContent);
      if (!summary && this.openRouter.lastError === 429) {
        this.setCooldown('openrouter', 60000);
      }
    }

    // 3. Final Reconciliation
    if (summary) {
      await this.db
        .update(signals)
        .set({
          aiSummary: summary,
          aiProcessed: true,
          aiFailed: false,
        })
        .where(eq(signals.id, id));
      
      logEvent('info', 'ai_processing_success', { signalId: id, provider: fallbackUsed ? 'openrouter' : 'groq' });
    } else {
      await this.db
        .update(signals)
        .set({
          aiProcessed: false,
          aiFailed: true,
        })
        .where(eq(signals.id, id));
      
      logEvent('error', 'ai_processing_failed', { signalId: id, reason: 'capacity_exhausted' });
    }
  }

  private isCooldown(provider: string): boolean {
    const expiry = this.cooldowns.get(provider);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.cooldowns.delete(provider);
      return false;
    }
    return true;
  }

  private setCooldown(provider: string, durationMs: number) {
    logEvent('warn', 'ai_provider_cooldown', { provider, durationMs });
    this.cooldowns.set(provider, Date.now() + durationMs);
  }
}
