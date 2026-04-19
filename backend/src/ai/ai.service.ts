import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalProvider } from './providers/local.provider';
import { GroqProvider } from './providers/groq.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { MacLocalProvider } from './providers/mac-local.provider';
import { PicoClawService } from './picoclaw.service';
import { RedisService } from './redis.service';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { signals } from '../database/schema';
import { eq } from 'drizzle-orm';
import { logEvent } from '../common/logger';
import { SettingsService, ProviderId, DEFAULT_SUMMARIZATION_PIPELINE, DEFAULT_TRANSLATION_PIPELINE } from './settings.service';

@Injectable()
export class AIService {
  private readonly cooldowns = new Map<string, number>();
  private readonly maxContentLength = 500;

  constructor(
    private readonly local: LocalProvider,
    private readonly groq: GroqProvider,
    private readonly openRouter: OpenRouterProvider,
    private readonly macLocal: MacLocalProvider,
    private readonly picoClaw: PicoClawService,
    private readonly redisService: RedisService,
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  private isLowQuality(summary: string): boolean {
    if (!summary || summary.length < 20) return true;
    const genericPhrases = [
      'provide the content',
      'no content provided',
      'i am an ai',
      'helpful assistant',
    ];
    const lower = summary.toLowerCase();
    return genericPhrases.some((phrase) => lower.includes(phrase));
  }

  private async getPipelineOrder(type: 'summarization' | 'translation'): Promise<ProviderId[]> {
    try {
      const config = await this.settingsService.getModelConfig();
      return type === 'summarization' ? config.summarizationPipeline : config.translationPipeline;
    } catch {
      return type === 'summarization' ? DEFAULT_SUMMARIZATION_PIPELINE : DEFAULT_TRANSLATION_PIPELINE;
    }
  }

  async translate(
    title: string,
    summary: string,
    targetLang: string,
    modelOverride?: string,
  ): Promise<{ title: string; aiSummary: string } | null> {
    const prompt = `Translate to ${targetLang}. Return ONLY a JSON object: {"title": "localized title", "aiSummary": "localized summary"}\n\nTitle: ${title}\nSummary: ${summary}`;
    const systemPrompt = 'You are a professional translator. Output only valid JSON.';
    const pipeline = await this.getPipelineOrder('translation');

    const parseResult = (response: string, fallbackTitle: string, fallbackSummary: string) => {
      const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
      return { title: parsed.title || fallbackTitle, aiSummary: parsed.aiSummary || fallbackSummary };
    };

    try {
      for (const providerId of pipeline) {
        if (this.isCooldown(providerId)) continue;

        try {
          if (providerId === 'mac_local' || providerId === 'pico_router') {
            // PicoClaw/Mac — direct structured response (no prompt needed)
            const picoResult = await this.picoClaw.translate(title, summary, targetLang);
            if (picoResult && !('error' in picoResult)) {
              logEvent('info', 'ai_translation_completed', { targetLang, source: providerId });
              return { title: picoResult.title, aiSummary: picoResult.aiSummary };
            }
          } else if (providerId === 'groq') {
            const res = await this.groq.complete(prompt, systemPrompt, modelOverride);
            if (res) {
              logEvent('info', 'ai_translation_completed', { targetLang, source: 'groq' });
              return parseResult(res, title, summary);
            }
            if (this.groq.lastError === 429) this.setCooldown('groq', 60000);
          } else if (providerId === 'openrouter') {
            const res = await this.openRouter.complete(prompt, systemPrompt, modelOverride);
            if (res) {
              logEvent('info', 'ai_translation_completed', { targetLang, source: 'openrouter' });
              return parseResult(res, title, summary);
            }
            if (this.openRouter.lastError === 429) this.setCooldown('openrouter', 60000);
          } else if (providerId === 'local') {
            if (await this.local.isEnabled()) {
              const res = await this.local.summarize('Translation Request', prompt);
              if (res) {
                logEvent('info', 'ai_translation_completed', { targetLang, source: 'local' });
                return parseResult(res, title, summary);
              }
            }
          }
        } catch {
          // Provider failed — continue to next
        }
      }

      logEvent('error', 'ai_translation_failed', { targetLang, reason: 'all_providers_exhausted' });
      return null;
    } catch (e) {
      logEvent('error', 'ai_translation_failed', { error: e.message });
      return null;
    }
  }

  async translateLowPower(
    title: string,
    summary: string,
    targetLang: string,
  ): Promise<{ title: string; aiSummary: string } | null> {
    // Smaller model for low-priority signals to save tokens
    const model = 'llama-3.1-8b-instant';
    return this.translate(title, summary, targetLang, model);
  }

  async translateSpeculative(
    title: string,
    summary: string,
    targetLang: string,
    modelOverride?: string,
  ): Promise<{ title: string; aiSummary: string } | null> {
    const prompt = `Translate to ${targetLang}. Return ONLY a JSON object: {"title": "localized title", "aiSummary": "localized summary"}\n\nTitle: ${title}\nSummary: ${summary}`;
    const systemPrompt = 'You are a professional translator. Output only valid JSON.';

    const promises: Promise<string | null>[] = [];
    if (!this.isCooldown('groq')) promises.push(this.groq.complete(prompt, systemPrompt, modelOverride).catch(() => null));
    if (!this.isCooldown('openrouter')) promises.push(this.openRouter.complete(prompt, systemPrompt, modelOverride).catch(() => null));

    if (promises.length === 0) return null;

    try {
      // Promise.any — first successful (non-null) response wins
      const response = await Promise.any(
        promises.map((p) =>
          p.then((r) => {
            if (!r) throw new Error('empty');
            return r;
          }),
        ),
      );
      const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
      logEvent('info', 'ai_translation_speculative_completed', { targetLang });
      return {
        title: parsed.title || title,
        aiSummary: parsed.aiSummary || summary,
      };
    } catch {
      // All failed — fall back to sequential
      return this.translate(title, summary, targetLang, modelOverride);
    }
  }

  async processSignal(
    id: string,
    title: string,
    content: string | null,
    score: number = 5,
  ) {
    const textContent = (content && content.trim().length > 0) ? content : title;
    const trimmedContent = this.trimContent(textContent);
    let summary: string | null = null;
    let provider = 'none';

    const pipeline = await this.getPipelineOrder('summarization');

    for (const providerId of pipeline) {
      if (summary && !this.isLowQuality(summary)) break; // Good summary — stop
      if (this.isCooldown(providerId)) continue;

      try {
        if (providerId === 'mac_local') {
          // Try direct Mac local first
          if (await this.macLocal.isAvailable()) {
            const macSummary = await this.macLocal.summarize(title, trimmedContent);
            if (macSummary && !this.isLowQuality(macSummary)) {
              summary = macSummary;
              provider = 'mac_local';
            }
          }
          // Also try PicoClaw router (proxies to Mac)
          if (!summary || this.isLowQuality(summary)) {
            const picoResult = await this.picoClaw.process(trimmedContent, score);
            if (picoResult?.result && picoResult.provider === 'mac') {
              const picoSummary = typeof picoResult.result === 'string'
                ? picoResult.result
                : JSON.stringify(picoResult.result);
              if (!this.isLowQuality(picoSummary)) {
                summary = picoSummary;
                provider = 'pico_mac';
              }
            }
          }
        } else if (providerId === 'pico_router') {
          const picoResult = await this.picoClaw.process(trimmedContent, score);
          if (picoResult?.result && picoResult.provider === 'mac') {
            const picoSummary = typeof picoResult.result === 'string'
              ? picoResult.result
              : JSON.stringify(picoResult.result);
            if (!this.isLowQuality(picoSummary)) {
              summary = picoSummary;
              provider = 'pico_mac';
            }
          }
        } else if (providerId === 'groq') {
          const groqSummary = await this.groq.summarize(title, trimmedContent);
          if (groqSummary) {
            summary = groqSummary;
            provider = 'groq';
          } else if (this.groq.lastError === 429) {
            this.setCooldown('groq', 60000);
          }
        } else if (providerId === 'openrouter') {
          logEvent('info', 'ai_pipeline_fallback', { signalId: id, from: provider, to: 'openrouter' });
          const orSummary = await this.openRouter.summarize(title, trimmedContent);
          if (orSummary) {
            summary = orSummary;
            provider = 'openrouter';
          } else if (this.openRouter.lastError === 429) {
            this.setCooldown('openrouter', 60000);
          }
        } else if (providerId === 'local') {
          if (await this.local.isEnabled()) {
            logEvent('info', 'ai_pipeline_fallback', { signalId: id, from: provider, to: 'local' });
            let localRetries = 0;
            while (!summary && localRetries < 2) {
              try { summary = await this.local.summarize(title, trimmedContent); } catch { summary = null; }
              localRetries++;
            }
            if (summary) provider = 'local';
          }
        }
      } catch {
        // Provider threw — continue to next
      }
    }

    if (summary && provider !== 'none') {
      logEvent('info', 'ai_provider_used', { signalId: id, provider });
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

      logEvent('info', 'ai_processing_success', {
        signalId: id,
        provider,
        fallbackUsed: provider !== 'groq',
      });
    } else {
      await this.db
        .update(signals)
        .set({
          aiProvider: 'failed',
          aiProcessed: false,
          aiFailed: true,
        })
        .where(eq(signals.id, id));

      logEvent('error', 'ai_processing_failed', {
        signalId: id,
        reason: 'capacity_exhausted',
      });
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
    const localEnabled = await this.local.isEnabled();
    const macLocalEnabled = await this.macLocal.isEnabled();

    const [
      local,
      macLocal,
      picoClaw,
      groq,
      openrouter,
      groqToday,
      groqAllTime,
      openrouterToday,
      openrouterAllTime,
      macLocalToday,
      macLocalAllTime,
    ] = await Promise.all([
      localEnabled
        ? this.local.checkHealth()
        : Promise.resolve({ status: 'disabled' }),
      macLocalEnabled
        ? this.macLocal.checkHealth()
        : Promise.resolve({ status: 'disabled' }),
      this.picoClaw.process('health_check', 0).then(r => ({ status: r ? 'healthy' : 'unhealthy' })).catch(() => ({ status: 'unhealthy' })),
      this.groq.checkHealth(),
      this.openRouter.checkHealth(),
      this.redisService.getTokenUsage('groq', true),
      this.redisService.getTokenUsage('groq', false),
      this.redisService.getTokenUsage('openrouter', true),
      this.redisService.getTokenUsage('openrouter', false),
      this.redisService.getTokenUsage('mac_local', true),
      this.redisService.getTokenUsage('mac_local', false),
    ]);

    const config = await this.settingsService.getModelConfig();
    const summarizationPipeline = config.summarizationPipeline;
    const translationPipeline = config.translationPipeline;

    return {
      local: localEnabled ? { ...local, model: 'Qwen2.5-0.5B' } : local,
      macLocal: macLocalEnabled ? { ...macLocal, model: 'llama-cpp-mac' } : macLocal,
      picoClaw: { ...picoClaw, model: 'Orchestrator' },
      groq: { ...groq, model: this.groq.modelName },
      openrouter: { ...openrouter, model: this.openRouter.modelName },
      localEnabled,
      macLocalEnabled,
      pipeline: summarizationPipeline.join(' → '),
      summarizationPipeline,
      translationPipeline,
      tokenUsage: {
        groq: { today: groqToday.total, allTime: groqAllTime.total },
        openrouter: { today: openrouterToday.total, allTime: openrouterAllTime.total },
        macLocal: { today: macLocalToday.total, allTime: macLocalAllTime.total },
      },
    };
  }
}
