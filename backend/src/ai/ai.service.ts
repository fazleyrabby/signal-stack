import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalProvider } from './providers/local.provider';
import { GroqProvider } from './providers/groq.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { RedisService } from './redis.service';
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
    private readonly redisService: RedisService,
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  async processSignal(id: string, title: string, content: string | null, score: number = 5) {
    const textContent = content || '';
    const trimmedContent = this.trimContent(textContent);
    let summary: string | null = null;
    let fallbackUsed = false;
    let provider = 'none';

    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    const localAiEnabled = this.configService.get<string>('LOCAL_AI_ENABLED') === 'true';
    const externalEnabled = this.configService.get<string>('AI_EXTERNAL_ENABLED') !== 'false';

    const useExternal = nodeEnv === 'production' && externalEnabled;
    const localOnly = !useExternal;

    if (localOnly) {
      logEvent('info', 'ai_local_only_mode', { signalId: id, nodeEnv, externalEnabled });
    }

    // Step 1: Try local first (always in dev, or in production with local enabled)
    const useLocalFirst = localAiEnabled && !this.isCooldown('local');
    let localRetries = 0;
    const maxLocalRetries = 2;

    if (useLocalFirst) {
      while (!summary && localRetries < maxLocalRetries) {
        try {
          summary = await Promise.race([
            this.local.summarize(title, trimmedContent),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
          ]);
        } catch {
          summary = null;
        }
        localRetries++;
      }

      if (summary) {
        provider = 'local';
        logEvent('info', 'ai_provider_used', { signalId: id, provider, mode: localOnly ? 'local_only' : 'production' });
      } else if (localOnly) {
        // Local only mode: if local fails after retries, mark as failed
        await this.db
          .update(signals)
          .set({
            aiProvider: 'failed',
            aiProcessed: false,
            aiFailed: true,
          })
          .where(eq(signals.id, id));

        logEvent('error', 'ai_processing_failed', { signalId: id, reason: 'local_failed_local_only_mode', retries: localRetries });
        throw new Error('Local AI failed in local-only mode');
      }
    }

    // Step 2: Production mode with external providers enabled - fallback chain
    if (!summary && useExternal) {
      // Fallback to Groq
      if (!this.isCooldown('groq')) {
        if (useLocalFirst && !summary) {
          logEvent('info', 'ai_pipeline_fallback', { signalId: id, from: provider, to: 'groq' });
        }
        fallbackUsed = true;
        summary = await this.groq.summarize(title, trimmedContent);
        if (summary) {
          provider = 'groq';
        } else if (this.groq.lastError === 429) {
          this.setCooldown('groq', 60000);
        }
      }

      // Final fallback to OpenRouter
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
    }

    if (summary && provider !== 'none') {
      logEvent('info', 'ai_provider_used', { signalId: id, provider, mode: localOnly ? 'local_only' : 'production' });
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
      // Throw so the queue can retry
      throw new Error('All AI providers failed');
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

  async getHealth() {
    const localEnabled = this.configService.get<string>('LOCAL_AI_ENABLED') === 'true';
    
    const [local, groq, openrouter, groqToday, groqAllTime, openrouterToday, openrouterAllTime] = await Promise.all([
      localEnabled ? this.local.checkHealth() : Promise.resolve({ status: 'disabled' }),
      this.groq.checkHealth(),
      this.openRouter.checkHealth(),
      this.redisService.getTokenUsage('groq', true),
      this.redisService.getTokenUsage('groq', false),
      this.redisService.getTokenUsage('openrouter', true),
      this.redisService.getTokenUsage('openrouter', false),
    ]);

    return {
      local: localEnabled ? { ...local, model: 'Qwen2.5-0.5B' } : local,
      groq: { ...groq, model: this.groq.modelName },
      openrouter: { ...openrouter, model: this.openRouter.modelName },
      localEnabled,
      pipeline: localEnabled ? 'local → groq → openrouter' : 'groq → openrouter',
      tokenUsage: {
        groq: { today: groqToday, allTime: groqAllTime },
        openrouter: { today: openrouterToday, allTime: openrouterAllTime },
      },
    };
  }
}
