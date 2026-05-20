import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../ai/settings.service';
import { GroqProvider } from '../../ai/providers/groq.provider';
import { OpenRouterProvider } from '../../ai/providers/openrouter.provider';
import { XPrompt } from '../prompts/x.prompt';
import { logEvent } from '../../common/logger';

@Injectable()
export class PulseAIService {
  private readonly logger = new Logger(PulseAIService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly groq: GroqProvider,
    private readonly openRouter: OpenRouterProvider,
  ) {}

  async generateDraft(signal: {
    id?: string;
    title: string;
    aiSummary?: string | null;
    categoryId: string;
    score: number;
  }): Promise<{ text: string; provider: string; model: string }> {
    const systemPrompt = XPrompt.getSystemPrompt();
    const prompt = XPrompt.buildUserPrompt(signal);

    const config = await this.settingsService.getModelConfig();
    const pipeline = config.summarizationPipeline;

    // Build unique ordered list of providers to try, prioritizing pipeline configuration
    const providersToTry = [...pipeline];
    if (!providersToTry.includes('groq')) providersToTry.push('groq');
    if (!providersToTry.includes('openrouter')) providersToTry.push('openrouter');

    for (const providerId of providersToTry) {
      try {
        if (providerId === 'groq') {
          const model = config.groqModel || 'llama-3.3-70b-versatile';
          const text = await this.groq.complete(prompt, systemPrompt, model);
          if (text && text.trim().length > 0) {
            logEvent('info', 'pulse_draft_generated', { signalId: signal.id, provider: 'groq', model });
            return { text: this.cleanResponse(text), provider: 'groq', model };
          }
        } else if (providerId === 'openrouter') {
          const model = config.openrouterModel || 'meta-llama/llama-3.3-70b-instruct';
          const text = await this.openRouter.complete(prompt, systemPrompt, model);
          if (text && text.trim().length > 0) {
            logEvent('info', 'pulse_draft_generated', { signalId: signal.id, provider: 'openrouter', model });
            return { text: this.cleanResponse(text), provider: 'openrouter', model };
          }
        }
      } catch (err: any) {
        this.logger.warn(`Provider ${providerId} failed during draft generation: ${err.message}`);
      }
    }

    throw new Error('All AI providers failed to generate draft');
  }

  private cleanResponse(text: string): string {
    let cleaned = text.trim();
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1).trim();
    }
    return cleaned;
  }
}
