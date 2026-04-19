import { Injectable } from '@nestjs/common';
import { SignalsRepository } from './signals.repository';
import { ScoredSignal } from '../common/types';
import { logEvent } from '../common/logger';
import { AIQueue } from '../ai/ai.queue';
import { AIService } from '../ai/ai.service';
import { TranslationQueue } from '../ai/translation.queue';
import { MetricsService } from '../ai/metrics.service';
import { SettingsService } from '../ai/settings.service';
import {
  TRANSLATION_VERSION,
  SOFT_BLOCK_TIMEOUT_MS,
  TranslationEntry,
  TranslationPriority,
} from '../ai/translation.constants';

function scoreToPriority(score: number): TranslationPriority {
  if (score >= 7) return 'HIGH';
  if (score >= 5) return 'MEDIUM';
  return 'LOW';
}

@Injectable()
export class SignalsService {
  constructor(
    private readonly repository: SignalsRepository,
    private readonly aiQueue: AIQueue,
    private readonly aiService: AIService,
    private readonly translationQueue: TranslationQueue,
    private readonly metrics: MetricsService,
    private readonly settingsService: SettingsService,
  ) {}

  async insertSignal(signal: ScoredSignal): Promise<boolean> {
    const exists = await this.repository.hashExists(signal.hash);
    if (exists) return false;

    const inserted = await this.repository.insert({
      source: signal.source,
      categoryId: signal.categoryId,
      title: signal.title,
      content: signal.content,
      url: signal.url,
      score: signal.score,
      severity: signal.severity,
      summary: signal.summary,
      aiCategory: signal.aiCategory,
      hash: signal.hash,
      publishedAt: signal.publishedAt,
      countryCode: signal.countryCode,
    });

    if (inserted) {
      logEvent('info', 'signal_processed', {
        source: inserted.source,
        score: inserted.score,
        severity: inserted.severity,
        title: inserted.title.slice(0, 80),
      });

      // All signals get AI processing, priority based on score
      this.aiQueue.enqueue(
        {
          id: inserted.id,
          title: inserted.title,
          content: inserted.content,
          score: inserted.score,
        },
        scoreToPriority(inserted.score),
      );

      // Trigger automatic translations if configured
      const config = await this.settingsService.getModelConfig();
      if (config.forceAllTranslations) {
        // Enqueue common languages (bn, es) for background translation
        for (const lang of ['bn', 'es']) {
          await this.translationQueue.enqueue(
            { 
              id: inserted.id, 
              title: inserted.title, 
              summary: inserted.summary || inserted.title, 
              lang,
              score: inserted.score
            },
            scoreToPriority(inserted.score),
          );
        }
      }
    }

    return !!inserted;
  }

  async getSignals(params: {
    page: number;
    limit: number;
    severity?: string;
    source?: string;
    categoryId?: string;
    countryCode?: string;
    since?: string;
    search?: string;
    sort?: string;
    order?: string;
    lang?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const order = params.order === 'asc' ? ('asc' as const) : ('desc' as const);

    let since: Date | undefined;
    if (params.since) {
      const parsed = new Date(params.since);
      if (!isNaN(parsed.getTime())) since = parsed;
    }

    const { data: rawData, total } = await this.repository.findAll({
      page,
      limit,
      severity: params.severity,
      source: params.source,
      categoryId: params.categoryId,
      countryCode: params.countryCode,
      since,
      search: params.search,
      sort: params.sort,
      order,
      excludeJobSources: true,
    });

    const lang = params.lang || 'en';
    const data = await Promise.all(
      rawData.map((signal) => this.localizeSignal(signal, lang)),
    );

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async localizeSignal(signal: any, lang: string): Promise<any> {
    if (lang === 'en' || !signal.aiSummary) return signal;

    const translations = (signal.translations || {}) as Record<string, TranslationEntry>;
    const existing = translations[lang];

    // Cache hit: current version exists
    if (existing && existing.v === TRANSLATION_VERSION) {
      await this.metrics.recordCacheHit(true);
      return { ...signal, title: existing.title, aiSummary: existing.aiSummary };
    }

    await this.metrics.recordCacheHit(false);

    const config = await this.settingsService.getModelConfig();
    const isHighPower = (signal.score || 5) >= config.translationThreshold;

    // Soft-block: try to translate within timeout
    let settled = false;
    const translationPromise = isHighPower
      ? this.aiService.translate(signal.title, signal.aiSummary, lang)
      : this.aiService.translateLowPower(signal.title, signal.aiSummary, lang);

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), SOFT_BLOCK_TIMEOUT_MS),
    );

    // Background write handler — runs regardless of race outcome
    translationPromise.then(async (translated) => {
      if (!translated) return;
      const entry: TranslationEntry = {
        title: translated.title,
        aiSummary: translated.aiSummary,
        v: TRANSLATION_VERSION,
      };
      try {
        await this.repository.setTranslation(signal.id, lang, entry);
      } catch (e: any) {
        logEvent('error', 'translation_background_write_failed', {
          signalId: signal.id,
          lang,
          error: e.message,
        });
      }
    }).catch(() => {/* ignore */});

    const winner = await Promise.race([translationPromise, timeoutPromise]);
    settled = true;

    if (winner) {
      // Translation was fast enough — return inline
      return { ...signal, title: winner.title, aiSummary: winner.aiSummary };
    }

    // Timeout won — enqueue async job for next request
    await this.translationQueue.enqueue(
      { 
        id: signal.id, 
        title: signal.title, 
        summary: signal.aiSummary, 
        lang,
        score: signal.score
      },
      scoreToPriority(signal.score || 5),
    );

    return { ...signal, translationPending: true }; // Return English with pending flag
  }

  async getStats() {
    return this.repository.getStats();
  }

  async getUniqueSources(categoryId?: string) {
    return this.repository.getUniqueSources(categoryId);
  }

  async getAIProviderStats() {
    return this.repository.getAIProviderStats();
  }

  async getTrends() {
    return this.repository.getTrends();
  }

  async getGeoStats() {
    return this.repository.getGeoStats();
  }
}
