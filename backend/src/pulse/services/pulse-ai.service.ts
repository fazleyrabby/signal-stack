import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../ai/settings.service';
import { GroqProvider } from '../../ai/providers/groq.provider';
import { OpenRouterProvider } from '../../ai/providers/openrouter.provider';
import { CanonicalPrompt } from '../prompts/canonical.prompt';
import { CanonicalIntelligenceAsset } from '../types/canonical';
import { logEvent } from '../../common/logger';

@Injectable()
export class PulseAIService {
  private readonly logger = new Logger(PulseAIService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly groq: GroqProvider,
    private readonly openRouter: OpenRouterProvider,
  ) {}

  async generateCanonicalAsset(signal: {
    id?: string;
    title: string;
    aiSummary?: string | null;
    categoryId: string;
    score: number;
    sourceUrl?: string | null;
  }): Promise<{ asset: CanonicalIntelligenceAsset; provider: string; model: string }> {
    const systemPrompt = CanonicalPrompt.getSystemPrompt();
    const userPrompt = CanonicalPrompt.buildUserPrompt(signal);

    const config = await this.settingsService.getModelConfig();
    const pipeline = config.summarizationPipeline;

    const providersToTry = [...pipeline];
    if (!providersToTry.includes('groq')) providersToTry.push('groq');
    if (!providersToTry.includes('openrouter')) providersToTry.push('openrouter');

    for (const providerId of providersToTry) {
      try {
        let raw: string | null = null;
        let usedModel = '';

        if (providerId === 'groq') {
          usedModel = config.groqModel || 'llama-3.3-70b-versatile';
          raw = await this.groq.complete(userPrompt, systemPrompt, usedModel);
        } else if (providerId === 'openrouter') {
          usedModel = config.openrouterModel || 'meta-llama/llama-3.3-70b-instruct';
          raw = await this.openRouter.complete(userPrompt, systemPrompt, usedModel);
        }

        if (!raw?.trim()) continue;

        const asset = this.parseCanonical(raw, signal);
        logEvent('info', 'pulse_canonical_generated', { signalId: signal.id, provider: providerId, model: usedModel });
        return { asset, provider: providerId, model: usedModel };
      } catch (err: any) {
        this.logger.warn(`Provider ${providerId} failed during canonical generation: ${err.message}`);
      }
    }

    throw new Error('All AI providers failed to generate canonical asset');
  }

  private parseCanonical(
    raw: string,
    signal: { title: string; aiSummary?: string | null; categoryId?: string; score?: number; sourceUrl?: string | null },
  ): CanonicalIntelligenceAsset {
    // Strip markdown fences if present
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
      const parsed = JSON.parse(cleaned) as Partial<CanonicalIntelligenceAsset>;

      // Validate minimum required fields
      const title = typeof parsed.title === 'string' && parsed.title.length > 0
        ? parsed.title : signal.title;
      const executiveSummary = typeof parsed.executiveSummary === 'string' && parsed.executiveSummary.length > 0
        ? parsed.executiveSummary : (signal.aiSummary || signal.title);

      return {
        title,
        executiveSummary,
        detailedSummary: typeof parsed.detailedSummary === 'string' ? parsed.detailedSummary : undefined,
        technicalBreakdown: typeof parsed.technicalBreakdown === 'string' ? parsed.technicalBreakdown : undefined,
        whyItMatters: typeof parsed.whyItMatters === 'string' ? parsed.whyItMatters : undefined,
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.filter((p): p is string => typeof p === 'string') : undefined,
        sourceUrl: typeof parsed.sourceUrl === 'string' && parsed.sourceUrl.length > 0
          ? parsed.sourceUrl : (signal.sourceUrl ?? undefined),
        relatedLinks: Array.isArray(parsed.relatedLinks) ? parsed.relatedLinks.filter((l): l is string => typeof l === 'string') : undefined,
        tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t): t is string => typeof t === 'string') : undefined,
        category: signal.categoryId,
        severity: typeof parsed.severity === 'number' ? parsed.severity : undefined,
        score: signal.score,
      };
    } catch {
      // JSON parse failed — build minimal canonical from available data
      this.logger.warn('Canonical JSON parse failed, falling back to raw text as executiveSummary');
      return {
        title: signal.title,
        executiveSummary: this.truncateToSentences(cleaned, 300) || signal.aiSummary || signal.title,
        sourceUrl: signal.sourceUrl ?? undefined,
        category: signal.categoryId,
        score: signal.score,
      };
    }
  }

  private truncateToSentences(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    let result = '';
    for (const s of sentences) {
      if ((result + s).length > maxLen) break;
      result += s;
    }
    return result.trim() || text.slice(0, maxLen).trim();
  }
}
