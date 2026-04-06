import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalProvider } from './providers/local.provider';
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
  private readonly maxContentLength = 500;

  constructor(
    private readonly local: LocalProvider,
    private readonly groq: GroqProvider,
    private readonly openRouter: OpenRouterProvider,
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  async processSignal(id: string, title: string, content: string | null) {
    const textContent = content || '';
    const trimmedContent = this.trimContent(textContent);
    let summary: string | null = null;
    let fallbackUsed = false;
    let provider = 'none';

    const localAiEnabled = this.configService.get<string>('LOCAL_AI_ENABLED') === 'true';

    if (localAiEnabled && !this.isCooldown('local')) {
      summary = await this.local.summarize(title, trimmedContent);
      if (summary) {
        provider = 'local';
      }
    }

    if (!summary && !this.isCooldown('groq')) {
      logEvent('info', 'ai_pipeline_fallback', { signalId: id, from: provider, to: 'groq' });
      fallbackUsed = true;
      summary = await this.groq.summarize(title, trimmedContent);
      if (summary) {
        provider = 'groq';
      } else if (this.groq.lastError === 429) {
        this.setCooldown('groq', 60000);
      }
    }

    if (!summary && !this.isCooldown('openrouter')) {
      logEvent('info', 'ai_pipeline_fallback', { signalId: id, from: provider, to: 'openrouter' });
      fallbackUsed = true;
      summary = await this.openRouter.summarize(title, trimmedContent);
      if (summary) {
        provider = 'openrouter';
      } else if (this.openRouter.lastError === 429) {
        this.setCooldown('openrouter', 60000);
      }
    }

    if (summary) {
      await this.db
        .update(signals)
        .set({
          aiSummary: summary,
          aiProvider: provider,
          aiProcessed: true,
          aiFailed: false,
        })
        .where(eq(signals.id, id));
      
      logEvent('info', 'ai_processing_success', { signalId: id, provider, fallbackUsed });
    } else {
      await this.db
        .update(signals)
        .set({
          aiProvider: 'failed',
          aiProcessed: false,
          aiFailed: true,
        })
        .where(eq(signals.id, id));
      
      logEvent('error', 'ai_processing_failed', { signalId: id, reason: 'capacity_exhausted' });
    }
  }

  private trimContent(content: string): string {
    return content.slice(0, this.maxContentLength);
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
