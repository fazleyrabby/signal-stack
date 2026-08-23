import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { logEvent } from '../../common/logger';
import { SettingsService } from '../settings.service';
import { RedisService } from '../redis.service';
import { cleanSummaryText, isLowQualitySummary } from '../../common/summary-cleaner';

@Injectable()
export class LocalProvider {
  private readonly timeout = 35000;
  private readonly maxTokens = 256;
  private readonly maxSummaryChars = 200;

  public lastError: number | null = null;
  private baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
    private readonly redisService: RedisService,
  ) {
    this.baseUrl =
      this.configService.get<string>('LOCAL_AI_URL') || 'http://llama:8080';
  }

  async isEnabled(): Promise<boolean> {
    const masterSwitch = this.configService.get<string>('LOCAL_AI_ENABLED') === 'true';
    if (!masterSwitch) return false;

    const dynamicConfig = await this.settingsService.getModelConfig();
    return dynamicConfig.localAiEnabled;
  }

  async summarize(title: string, content: string): Promise<string | null> {
    this.lastError = null;

    if (!(await this.isEnabled())) {
      return null;
    }

    try {
      const prompt = this.buildPrompt(title, content);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen.gguf',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: this.maxTokens,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.lastError = response.status;
        return null;
      }

      const data = await response.json();

      // Track token usage
      const usage = data?.usage;
      if (usage) {
        await this.redisService.trackTokens(
          'local',
          usage.prompt_tokens || 0,
          usage.completion_tokens || 0,
        );
      }

      const message = data?.choices?.[0]?.message;
      const result = (
        message?.content ||
        message?.reasoning_content ||
        ''
      ).trim();
      return result ? this.cleanResponse(result) : null;
    } catch (error: any) {
      this.lastError = error.name === 'AbortError' ? 408 : 500;
      logEvent('warn', 'local_provider_error', {
        status: this.lastError,
        message: error.message,
      });
      return null;
    }
  }

  async checkHealth(): Promise<{
    status: string;
    latency?: number;
    error?: string;
  }> {
    if (!(await this.isEnabled())) {
      return { status: 'disabled' };
    }

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen.gguf',
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

  private buildPrompt(title: string, content: string): string {
    const trimmedContent = content.slice(0, 140);
    return `Write exactly one short sentence (12-22 words) explaining why this matters.
Rules: plain English, no markdown, no line breaks, end with a period. Do NOT output reasoning or <think> tags.
Title: ${title}
Content: ${trimmedContent}`;
  }

  private cleanResponse(text: string): string {
    let cleaned = cleanSummaryText(text);
    if (isLowQualitySummary(cleaned)) {
      return '';
    }

    // Prefer a complete first sentence if present.
    const firstSentence = cleaned.match(/^[^.!?]+[.!?]/)?.[0]?.trim();
    if (firstSentence && firstSentence.length >= 30) {
      cleaned = firstSentence;
    }

    if (cleaned.length > this.maxSummaryChars) {
      // Prefer a natural stop at punctuation inside the limit.
      const punctIdx = Math.max(
        cleaned.lastIndexOf('.', this.maxSummaryChars),
        cleaned.lastIndexOf('!', this.maxSummaryChars),
        cleaned.lastIndexOf('?', this.maxSummaryChars),
      );

      if (punctIdx >= 60) {
        cleaned = cleaned.slice(0, punctIdx + 1).trim();
      } else {
        // Fall back to safe word boundary cut.
        cleaned = cleaned
          .slice(0, this.maxSummaryChars)
          .replace(/\s+\S*$/, '')
          .trim();
        if (!/[.!?]$/.test(cleaned)) {
          cleaned += '.';
        }
      }
    } else if (!/[.!?]$/.test(cleaned)) {
      cleaned += '.';
    }

    return cleaned;
  }
}
