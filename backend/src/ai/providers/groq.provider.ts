import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis.service';
import { SettingsService } from '../settings.service';
import { logEvent } from '../../common/logger';
import { cleanSummaryText, isLowQualitySummary } from '../../common/summary-cleaner';

@Injectable()
export class GroqProvider implements OnModuleInit {
  private apiKey: string | undefined;
  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  private defaultModel = 'openai/gpt-oss-120b';

  public lastError: number | null = null;
  public modelName = 'openai/gpt-oss-120b';

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly settingsService: SettingsService,
  ) {
    this.apiKey = this.configService.get<string>('GROQ_API_KEY');
  }

  async onModuleInit() {
    const stored = await this.settingsService.getSetting('groq_api_key');
    if (stored) this.apiKey = stored;
  }

  updateApiKey(key: string) {
    this.apiKey = key || undefined;
  }

  private async getModel(): Promise<string> {
    const config = await this.settingsService.getModelConfig();
    const model = config.groqModel || this.defaultModel;
    this.modelName = model;
    return model;
  }

  async summarize(title: string, content: string): Promise<string | null> {
    this.lastError = null;
    if (!this.apiKey) {
      return null;
    }

    const model = await this.getModel();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'Summarize why this matters in one sentence. Max 30 words, no fluff, plain English. Do NOT output reasoning or <think> tags. Output only the final one-sentence summary.',
            },
            {
              role: 'user',
              content: `Title: ${title}\n\nContent: ${content}`,
            },
          ],
          temperature: 0.1,
          max_tokens: 400,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        this.lastError = res.status;
        return null;
      }

      const data = await res.json();

      // Track token usage
      const usage = data?.usage;
      if (usage) {
        await this.redisService.trackTokens(
          'groq',
          usage.prompt_tokens || 0,
          usage.completion_tokens || 0,
        );
      }

      const result = data?.choices?.[0]?.message?.content?.trim();
      return result ? this.cleanResponse(result) : null;
    } catch (error: any) {
      this.lastError = error.name === 'AbortError' ? 408 : 500;
      logEvent('warn', 'groq_provider_error', {
        status: this.lastError,
        message: error.message,
      });
      return null;
    }
  }

  async complete(
    prompt: string,
    systemPrompt?: string,
    modelOverride?: string,
    maxTokens: number = 2048,
    jsonMode: boolean = false,
  ): Promise<string | null> {
    if (!this.apiKey) return null;

    const defaultModel = await this.getModel();
    const candidateModels = [
      modelOverride || defaultModel,
      'openai/gpt-oss-20b',
      'openai/gpt-oss-120b',
      'qwen/qwen3.6-27b',
      'allam-2-7b',
    ].filter((m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i);

    for (const model of candidateModels) {
      try {
        const body: Record<string, any> = {
          model,
          messages: [
            { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: maxTokens,
        };
        if (jsonMode) {
          body.response_format = { type: 'json_object' };
        }

        const res = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          logEvent('warn', 'groq_complete_error', {
            model,
            status: res.status,
            error: errData?.error?.message || res.statusText,
          });
          continue;
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content?.trim();
        if (content) {
          return content;
        }
      } catch (err: any) {
        logEvent('warn', 'groq_complete_exception', { model, error: err.message });
      }
    }

    return null;
  }

  private cleanResponse(text: string): string {
    const cleaned = cleanSummaryText(text);
    if (isLowQualitySummary(cleaned)) {
      return '';
    }
    return cleaned.slice(0, 250);
  }

  async checkHealth(): Promise<{
    status: string;
    latency?: number;
    error?: string;
  }> {
    if (!this.apiKey) {
      return { status: 'no_api_key' };
    }

    const model = await this.getModel();
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { status: 'healthy', latency: Date.now() - start };
    } catch (error: any) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}
